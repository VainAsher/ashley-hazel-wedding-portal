"""Best-effort 30-second preview matching via the iTunes Search API.

Keyless and free: https://itunes.apple.com/search returns streamable 30s
preview URLs plus artwork for a title/artist search. Matching is strictly
best-effort — any failure (timeout, non-200, bad JSON, weak match) returns
None so approving a song request is never blocked; the guest jukebox simply
skips songs without a preview.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import httpx

from app.logging import get_logger


logger = get_logger(__name__)

ITUNES_SEARCH_URL = "https://itunes.apple.com/search"
SEARCH_TIMEOUT_SECONDS = 3.0
RESULT_LIMIT = 5

# Minimum token-overlap scores before a result counts as "the same song".
TITLE_THRESHOLD = 0.5
ARTIST_THRESHOLD = 0.4

_WORD_PATTERN = re.compile(r"[a-z0-9]+")


@dataclass
class PreviewMatch:
    preview_url: str
    artwork_url: str | None = None
    matched_title: str | None = None
    matched_artist: str | None = None


def _tokens(value: str | None) -> set[str]:
    return set(_WORD_PATTERN.findall((value or "").lower()))


def _overlap(query: str | None, candidate: str | None) -> float:
    """Share of the query's tokens present in the candidate (0..1)."""
    query_tokens = _tokens(query)
    if not query_tokens:
        return 0.0
    return len(query_tokens & _tokens(candidate)) / len(query_tokens)


def _score(title: str, artist: str | None, result: dict[str, object]) -> float | None:
    """Score a search result; None means it fails the acceptance thresholds."""
    title_overlap = _overlap(title, str(result.get("trackName") or ""))
    if title_overlap < TITLE_THRESHOLD:
        return None
    if artist:
        artist_overlap = _overlap(artist, str(result.get("artistName") or ""))
        if artist_overlap < ARTIST_THRESHOLD:
            return None
        return title_overlap + artist_overlap
    return title_overlap


def find_preview(title: str, artist: str | None) -> PreviewMatch | None:
    """Find a 30s preview for a song. Never raises; None on any failure."""
    try:
        term = f"{title} {artist}".strip() if artist else title
        response = httpx.get(
            ITUNES_SEARCH_URL,
            params={
                "term": term,
                "media": "music",
                "entity": "song",
                "limit": str(RESULT_LIMIT),
            },
            timeout=SEARCH_TIMEOUT_SECONDS,
            follow_redirects=True,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        results = data.get("results") if isinstance(data, dict) else None
        if not isinstance(results, list):
            return None

        best: tuple[float, dict[str, object]] | None = None
        for result in results:
            if not isinstance(result, dict) or not result.get("previewUrl"):
                continue
            score = _score(title, artist, result)
            if score is None:
                continue
            if best is None or score > best[0]:
                best = (score, result)

        if best is None:
            return None
        matched = best[1]
        return PreviewMatch(
            preview_url=str(matched["previewUrl"]),
            artwork_url=str(matched["artworkUrl100"]) if matched.get("artworkUrl100") else None,
            matched_title=str(matched["trackName"]) if matched.get("trackName") else None,
            matched_artist=str(matched["artistName"]) if matched.get("artistName") else None,
        )
    except Exception:  # noqa: BLE001 - best-effort: never block an approval
        logger.warning("music_preview_match_failed")
        return None

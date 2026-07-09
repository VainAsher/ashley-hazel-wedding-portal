"""Best-effort metadata lookup for pasted music links (Spotify / YouTube).

Uses each provider's public oEmbed endpoint. Resolution is strictly
best-effort: any failure (timeout, non-200, bad JSON, unrecognised URL)
returns None so a song request submission is never blocked or slowed down
by more than the short oEmbed timeout.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import httpx

from app.logging import get_logger


logger = get_logger(__name__)

OEMBED_TIMEOUT_SECONDS = 3.0

SPOTIFY_TRACK_PATTERN = re.compile(
    r"open\.spotify\.com/(?:intl-[a-z]{2}(?:-[a-zA-Z]{2})?/)?track/([A-Za-z0-9]+)"
)
YOUTUBE_PATTERN = re.compile(r"(?:youtube\.com/watch|youtu\.be/)")


@dataclass
class MusicMetadata:
    resolved_title: str | None = None
    resolved_artist: str | None = None
    artwork_url: str | None = None
    spotify_track_id: str | None = None


def _fetch_oembed(endpoint: str, params: dict[str, str]) -> dict[str, object] | None:
    response = httpx.get(
        endpoint,
        params=params,
        timeout=OEMBED_TIMEOUT_SECONDS,
        follow_redirects=True,
    )
    if response.status_code != 200:
        return None
    data = response.json()
    return data if isinstance(data, dict) else None


def _text_or_none(data: dict[str, object], key: str) -> str | None:
    value = data.get(key)
    return str(value) if value else None


def resolve_music_url(url: str) -> MusicMetadata | None:
    """Resolve a pasted Spotify/YouTube link to display metadata.

    Returns None for anything that cannot be resolved — never raises.
    """
    try:
        spotify_match = SPOTIFY_TRACK_PATTERN.search(url)
        if spotify_match:
            data = _fetch_oembed("https://open.spotify.com/oembed", {"url": url})
            if data is None:
                return None
            # Spotify oEmbed's title is the track title; it has no artist field.
            return MusicMetadata(
                resolved_title=_text_or_none(data, "title"),
                artwork_url=_text_or_none(data, "thumbnail_url"),
                spotify_track_id=spotify_match.group(1),
            )
        if YOUTUBE_PATTERN.search(url):
            data = _fetch_oembed(
                "https://www.youtube.com/oembed", {"url": url, "format": "json"}
            )
            if data is None:
                return None
            # YouTube oEmbed: title is the video title, author_name the channel.
            return MusicMetadata(
                resolved_title=_text_or_none(data, "title"),
                resolved_artist=_text_or_none(data, "author_name"),
                artwork_url=_text_or_none(data, "thumbnail_url"),
            )
        return None
    except Exception:  # noqa: BLE001 - best-effort: never block a submission
        logger.warning("music_metadata_resolution_failed")
        return None

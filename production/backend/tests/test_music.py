from __future__ import annotations

from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import SongRequest, Wedding
from app.utils import music_metadata
from tests.fixtures.guests import TEST_WEDDING_ID


@pytest.fixture()
def set_wedding_phase(db_session: Session) -> Iterator[Callable[[str], None]]:
    """Snapshot the shared seed wedding's phase and restore it after the test.

    The shared test DB's phase may be anything at start ('live' or 'planning'),
    so each test sets exactly what it needs through the returned setter.
    """
    wedding = db_session.get(Wedding, TEST_WEDDING_ID)
    assert wedding is not None
    original = wedding.phase

    def _set(phase: str) -> None:
        db_session.expire_all()
        target = db_session.get(Wedding, TEST_WEDDING_ID)
        assert target is not None
        target.phase = phase
        db_session.commit()

    try:
        yield _set
    finally:
        db_session.expire_all()
        target = db_session.get(Wedding, TEST_WEDDING_ID)
        if target is not None:
            target.phase = original
            db_session.commit()


@pytest.fixture()
def cleanup_song_requests(db_session: Session) -> Iterator[None]:
    yield
    db_session.query(SongRequest).filter(
        SongRequest.wedding_id == TEST_WEDDING_ID,
        SongRequest.requested_by.like("Pytest%"),
    ).delete(synchronize_session=False)
    db_session.commit()


@pytest.fixture()
def stub_metadata(monkeypatch: pytest.MonkeyPatch) -> music_metadata.MusicMetadata:
    """Replace the oEmbed resolver so no test ever performs a network call."""
    metadata = music_metadata.MusicMetadata(
        resolved_title="Dancing Queen",
        resolved_artist="ABBA",
        artwork_url="https://images.example/dancing-queen.jpg",
        spotify_track_id="0GjEhVFGZW8afUYGChu3Rr",
    )
    monkeypatch.setattr(music_metadata, "resolve_music_url", lambda url: metadata)
    return metadata


def make_song_request(**overrides: object) -> SongRequest:
    values: dict[str, object] = {
        "wedding_id": TEST_WEDDING_ID,
        "title": "Pytest Song",
        "requested_by": "Pytest Seeder",
        "status": "approved",
    }
    values.update(overrides)
    return SongRequest(**values)


class TestSubmitSongRequest:
    def test_guest_submit_is_pending_with_metadata(
        self,
        guest_session: TestClient,
        set_wedding_phase: Callable[[str], None],
        cleanup_song_requests: None,
        stub_metadata: music_metadata.MusicMetadata,
    ) -> None:
        set_wedding_phase("live")
        response = guest_session.post(
            "/api/music/requests",
            json={
                "title": "  Dancing Queen  ",
                "artist": "ABBA",
                "source_url": "https://open.spotify.com/track/0GjEhVFGZW8afUYGChu3Rr",
                "dedication": "For the aunties",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["wedding_id"] == TEST_WEDDING_ID
        assert data["status"] == "pending"
        assert data["title"] == "Dancing Queen"
        assert data["artist"] == "ABBA"
        assert data["dedication"] == "For the aunties"
        # requested_by comes from the session, not the request body.
        assert data["requested_by"] == "Pytest Guest"
        # Best-effort metadata resolution was applied from the (stubbed) resolver.
        assert data["resolved_title"] == stub_metadata.resolved_title
        assert data["resolved_artist"] == stub_metadata.resolved_artist
        assert data["artwork_url"] == stub_metadata.artwork_url
        assert data["spotify_track_id"] == stub_metadata.spotify_track_id

    def test_submit_without_link_leaves_metadata_null(
        self,
        guest_session: TestClient,
        set_wedding_phase: Callable[[str], None],
        cleanup_song_requests: None,
    ) -> None:
        set_wedding_phase("live")
        response = guest_session.post(
            "/api/music/requests", json={"title": "Mr. Brightside"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "pending"
        assert data["resolved_title"] is None
        assert data["resolved_artist"] is None
        assert data["artwork_url"] is None
        assert data["spotify_track_id"] is None

    def test_blank_title_rejected(
        self,
        guest_session: TestClient,
        set_wedding_phase: Callable[[str], None],
    ) -> None:
        set_wedding_phase("live")
        response = guest_session.post("/api/music/requests", json={"title": "   "})
        assert response.status_code == 422

    def test_missing_title_rejected(
        self,
        guest_session: TestClient,
        set_wedding_phase: Callable[[str], None],
    ) -> None:
        set_wedding_phase("live")
        response = guest_session.post("/api/music/requests", json={"artist": "ABBA"})
        assert response.status_code == 422

    def test_guest_blocked_when_phase_not_live(
        self,
        guest_session: TestClient,
        set_wedding_phase: Callable[[str], None],
    ) -> None:
        set_wedding_phase("planning")
        response = guest_session.post(
            "/api/music/requests", json={"title": "Too Early"}
        )
        assert response.status_code == 403

    def test_coordinator_create_is_approved_and_phase_exempt(
        self,
        coordinator_session: TestClient,
        set_wedding_phase: Callable[[str], None],
        cleanup_song_requests: None,
    ) -> None:
        # Coordinators/couple are exempt from the live-phase gate.
        set_wedding_phase("planning")
        response = coordinator_session.post(
            "/api/music/requests", json={"title": "First Dance"}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "approved"
        assert data["requested_by"] == "Pytest Coordinator"


class TestSongWall:
    def test_wall_shows_approved_only_in_wall_order(
        self,
        guest_session: TestClient,
        db_session: Session,
        cleanup_song_requests: None,
    ) -> None:
        plain = make_song_request(title="Pytest Plain", position=2)
        pinned = make_song_request(title="Pytest Pinned", pinned=True)
        first = make_song_request(title="Pytest First", position=1)
        unpositioned = make_song_request(title="Pytest Unpositioned")
        pending = make_song_request(title="Pytest Pending", status="pending")
        blocked = make_song_request(title="Pytest Blocked", status="blocked")
        db_session.add_all([plain, pinned, first, unpositioned, pending, blocked])
        db_session.commit()

        response = guest_session.get("/api/music/requests/wall")
        assert response.status_code == 200
        items = response.json()
        assert all(item["status"] == "approved" for item in items)

        ids = [item["id"] for item in items]
        assert pending.id not in ids
        assert blocked.id not in ids
        # Wall order: pinned first, then position ASC (nulls last), then created.
        ours = [i for i in ids if i in {plain.id, pinned.id, first.id, unpositioned.id}]
        assert ours == [pinned.id, first.id, plain.id, unpositioned.id]


class TestAdminSongRequests:
    def test_admin_list_requires_coordinator(self, guest_session: TestClient) -> None:
        assert guest_session.get("/api/music/requests").status_code == 403

    def test_admin_list_returns_all_newest_first(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_song_requests: None,
    ) -> None:
        older = make_song_request(title="Pytest Older", status="pending")
        db_session.add(older)
        db_session.commit()
        newer = make_song_request(title="Pytest Newer", status="blocked")
        db_session.add(newer)
        db_session.commit()

        response = coordinator_session.get("/api/music/requests")
        assert response.status_code == 200
        ids = [item["id"] for item in response.json()]
        assert older.id in ids
        assert newer.id in ids
        # Newest first: the later insert precedes the earlier one.
        assert ids.index(newer.id) < ids.index(older.id)

    def test_patch_status_transitions_and_curation(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_song_requests: None,
    ) -> None:
        song = make_song_request(title="Pytest Moderated", status="pending")
        db_session.add(song)
        db_session.commit()

        approved = coordinator_session.patch(
            f"/api/music/requests/{song.id}", json={"status": "approved"}
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "approved"

        curated = coordinator_session.patch(
            f"/api/music/requests/{song.id}",
            json={"pinned": True, "position": 3, "title": "Pytest Renamed"},
        )
        assert curated.status_code == 200
        data = curated.json()
        assert data["pinned"] is True
        assert data["position"] == 3
        assert data["title"] == "Pytest Renamed"

        blocked = coordinator_session.patch(
            f"/api/music/requests/{song.id}", json={"status": "blocked"}
        )
        assert blocked.status_code == 200
        assert blocked.json()["status"] == "blocked"

        db_session.expire_all()
        persisted = db_session.get(SongRequest, song.id)
        assert persisted is not None
        assert persisted.status == "blocked"
        assert persisted.pinned is True

    def test_patch_invalid_status_rejected(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_song_requests: None,
    ) -> None:
        song = make_song_request(title="Pytest Invalid Status", status="pending")
        db_session.add(song)
        db_session.commit()
        response = coordinator_session.patch(
            f"/api/music/requests/{song.id}", json={"status": "banger"}
        )
        assert response.status_code == 422

    def test_patch_unknown_returns_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.patch(
            "/api/music/requests/999999", json={"status": "approved"}
        )
        assert response.status_code == 404

    def test_delete_removes_request(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_song_requests: None,
    ) -> None:
        song = make_song_request(title="Pytest Deleted")
        db_session.add(song)
        db_session.commit()
        song_id = song.id

        response = coordinator_session.delete(f"/api/music/requests/{song_id}")
        assert response.status_code == 204
        db_session.expire_all()
        assert db_session.get(SongRequest, song_id) is None

    def test_delete_unknown_returns_404(self, coordinator_session: TestClient) -> None:
        assert coordinator_session.delete("/api/music/requests/999999").status_code == 404


class TestMergeSongRequests:
    def test_merge_folds_duplicates_into_primary(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_song_requests: None,
    ) -> None:
        primary = make_song_request(
            title="Pytest Anthem",
            status="pending",
            requested_by="Pytest Alice",
            dedication="For mum",
        )
        dup_no_dedication = make_song_request(
            title="Pytest Anthem", status="pending", requested_by="Pytest Bob"
        )
        dup_repeat_requester = make_song_request(
            title="Pytest Anthem",
            status="pending",
            requested_by="Pytest Alice",
            dedication="Play it loud",
        )
        db_session.add_all([primary, dup_no_dedication, dup_repeat_requester])
        db_session.commit()
        primary_id = primary.id
        duplicate_ids = [dup_no_dedication.id, dup_repeat_requester.id]

        response = coordinator_session.post(
            f"/api/music/requests/{primary_id}/merge",
            json={"duplicate_ids": duplicate_ids},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == primary_id
        # Dedications joined with " · " skipping nulls; requesters deduped.
        assert data["dedication"] == "For mum · Play it loud"
        assert data["requested_by"] == "Pytest Alice, Pytest Bob"

        db_session.expire_all()
        for duplicate_id in duplicate_ids:
            assert db_session.get(SongRequest, duplicate_id) is None

    def test_merge_rejects_primary_as_duplicate(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_song_requests: None,
    ) -> None:
        primary = make_song_request(title="Pytest Self Merge", status="pending")
        db_session.add(primary)
        db_session.commit()
        response = coordinator_session.post(
            f"/api/music/requests/{primary.id}/merge",
            json={"duplicate_ids": [primary.id]},
        )
        assert response.status_code == 400

    def test_merge_unknown_duplicate_returns_404(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_song_requests: None,
    ) -> None:
        primary = make_song_request(title="Pytest Merge Missing", status="pending")
        db_session.add(primary)
        db_session.commit()
        response = coordinator_session.post(
            f"/api/music/requests/{primary.id}/merge",
            json={"duplicate_ids": [999999]},
        )
        assert response.status_code == 404

    def test_merge_unknown_primary_returns_404(
        self, coordinator_session: TestClient
    ) -> None:
        response = coordinator_session.post(
            "/api/music/requests/999999/merge", json={"duplicate_ids": [1]}
        )
        assert response.status_code == 404

    def test_merge_empty_duplicates_rejected(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_song_requests: None,
    ) -> None:
        primary = make_song_request(title="Pytest Merge Empty", status="pending")
        db_session.add(primary)
        db_session.commit()
        response = coordinator_session.post(
            f"/api/music/requests/{primary.id}/merge", json={"duplicate_ids": []}
        )
        assert response.status_code == 422


class TestExportDjPack:
    def test_export_csv_has_approved_rows_in_wall_order(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_song_requests: None,
    ) -> None:
        pinned = make_song_request(
            title="Pytest Opener", artist="Pytest Band", pinned=True,
            dedication="Get up!",
        )
        second = make_song_request(title="Pytest Second", position=1)
        blocked = make_song_request(title="Pytest Never", status="blocked")
        pending = make_song_request(title="Pytest Waiting", status="pending")
        db_session.add_all([pinned, second, blocked, pending])
        db_session.commit()

        response = coordinator_session.get("/api/music/export?format=csv")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
        assert "wedding-playlist.csv" in response.headers["content-disposition"]

        body = response.text
        lines = body.splitlines()
        assert lines[0] == "position,title,artist,requested_by,dedication,source_url"
        # Approved rows only — blocked and pending never reach the CSV.
        assert "Pytest Never" not in body
        assert "Pytest Waiting" not in body
        # Wall order: pinned row before the positioned row.
        assert body.index("Pytest Opener") < body.index("Pytest Second")
        assert "Pytest Band" in body
        assert "Get up!" in body

    def test_export_text_has_playlist_and_do_not_play_sections(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_song_requests: None,
    ) -> None:
        pinned = make_song_request(title="Pytest Star Song", pinned=True)
        blocked = make_song_request(title="Pytest Banned Song", status="blocked")
        db_session.add_all([pinned, blocked])
        db_session.commit()

        response = coordinator_session.get("/api/music/export?format=text")
        assert response.status_code == 200
        assert "dj-pack.txt" in response.headers["content-disposition"]

        body = response.text
        assert "WEDDING PLAYLIST" in body
        assert "DO NOT PLAY" in body
        # Pinned songs are marked with a star in the playlist section.
        playlist_section, do_not_play_section = body.split("DO NOT PLAY", 1)
        assert "★" in playlist_section
        assert "Pytest Star Song" in playlist_section
        assert "Pytest Banned Song" in do_not_play_section
        assert "Pytest Banned Song" not in playlist_section

    def test_export_invalid_format_rejected(
        self, coordinator_session: TestClient
    ) -> None:
        response = coordinator_session.get("/api/music/export?format=vinyl")
        assert response.status_code == 422

    def test_export_requires_coordinator(self, guest_session: TestClient) -> None:
        assert guest_session.get("/api/music/export?format=csv").status_code == 403


class TestUnauthenticated:
    def test_all_endpoints_require_authentication(self, client: TestClient) -> None:
        assert client.post("/api/music/requests", json={"title": "x"}).status_code == 401
        assert client.get("/api/music/requests/wall").status_code == 401
        assert client.get("/api/music/requests").status_code == 401
        assert client.patch(
            "/api/music/requests/1", json={"status": "approved"}
        ).status_code == 401
        assert client.delete("/api/music/requests/1").status_code == 401
        assert client.post(
            "/api/music/requests/1/merge", json={"duplicate_ids": [2]}
        ).status_code == 401
        assert client.get("/api/music/export?format=csv").status_code == 401


class FakeOembedResponse:
    def __init__(self, status_code: int, payload: dict[str, object]) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self) -> dict[str, object]:
        return self._payload


class TestResolveMusicUrl:
    """Unit tests for the oEmbed resolver with httpx stubbed — no network."""

    def test_spotify_track_resolves_title_and_track_id(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def fake_get(url: str, **kwargs: object) -> FakeOembedResponse:
            assert url == "https://open.spotify.com/oembed"
            return FakeOembedResponse(
                200,
                {"title": "Dancing Queen", "thumbnail_url": "https://i.example/dq.jpg"},
            )

        monkeypatch.setattr(music_metadata.httpx, "get", fake_get)
        metadata = music_metadata.resolve_music_url(
            "https://open.spotify.com/track/0GjEhVFGZW8afUYGChu3Rr?si=abc"
        )
        assert metadata is not None
        assert metadata.resolved_title == "Dancing Queen"
        assert metadata.artwork_url == "https://i.example/dq.jpg"
        assert metadata.spotify_track_id == "0GjEhVFGZW8afUYGChu3Rr"

    def test_youtube_resolves_title_and_channel_as_artist(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def fake_get(url: str, **kwargs: object) -> FakeOembedResponse:
            assert url == "https://www.youtube.com/oembed"
            return FakeOembedResponse(
                200,
                {
                    "title": "Mr. Brightside (Official Video)",
                    "author_name": "The Killers",
                    "thumbnail_url": "https://i.ytimg.example/hq.jpg",
                },
            )

        monkeypatch.setattr(music_metadata.httpx, "get", fake_get)
        metadata = music_metadata.resolve_music_url(
            "https://www.youtube.com/watch?v=gGdGFtwCNBE"
        )
        assert metadata is not None
        assert metadata.resolved_title == "Mr. Brightside (Official Video)"
        assert metadata.resolved_artist == "The Killers"
        assert metadata.artwork_url == "https://i.ytimg.example/hq.jpg"
        assert metadata.spotify_track_id is None

    def test_unrecognised_url_returns_none_without_fetching(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def fail_get(url: str, **kwargs: object) -> FakeOembedResponse:
            raise AssertionError("oEmbed must not be fetched for unknown URLs")

        monkeypatch.setattr(music_metadata.httpx, "get", fail_get)
        assert music_metadata.resolve_music_url("https://example.com/song") is None

    def test_non_200_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(
            music_metadata.httpx,
            "get",
            lambda url, **kwargs: FakeOembedResponse(404, {}),
        )
        assert (
            music_metadata.resolve_music_url("https://youtu.be/gGdGFtwCNBE") is None
        )

    def test_fetch_failure_returns_none(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        def boom(url: str, **kwargs: object) -> FakeOembedResponse:
            raise music_metadata.httpx.ConnectError("no network in tests")

        monkeypatch.setattr(music_metadata.httpx, "get", boom)
        assert (
            music_metadata.resolve_music_url(
                "https://open.spotify.com/track/0GjEhVFGZW8afUYGChu3Rr"
            )
            is None
        )

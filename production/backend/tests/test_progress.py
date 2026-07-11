"""GET /api/portal/me/progress — the guest onboarding checklist source.

Each boolean derives from an existence query for the CURRENT member:
- rsvp_submitted:  id-linked (session guest_id -> guests.rsvp_status)
- song_requested:  name-matched (song_requests.requested_by == session name)
- photo_submitted: name-matched (gallery_items.uploaded_by == session name)
- blessing_posted: name-matched (blessings.author_name == session name)

NOTE: coordinator_session and guest_session TestClient fixtures share one
client and interfere in the SAME test, so every test here uses exactly one
authenticated session.
"""

from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import (
    Blessing,
    GalleryItem,
    Guest,
    Invite,
    SongRequest,
    Wedding,
)
from tests.fixtures.guests import TEST_WEDDING_ID


PROGRESS_URL = "/api/portal/me/progress"
NAME_PREFIX = "Pytest Progress"

# A tiny but valid 1x1 PNG (same bytes test_gallery.py uses).
TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000154a24f3b0000000049454e44ae42"
    "6082"
)

ALL_FALSE = {
    "rsvp_submitted": False,
    "song_requested": False,
    "photo_submitted": False,
    "blessing_posted": False,
}


@pytest.fixture()
def progress_guest_name() -> str:
    """A per-test unique display name so name-matched signals stay isolated
    on the shared test database."""
    return f"{NAME_PREFIX} {uuid4().hex[:10]}"


@pytest.fixture()
def progress_guest_session(
    client: TestClient,
    db_session: Session,
    progress_guest_name: str,
) -> Iterator[tuple[TestClient, Guest]]:
    """A guest session whose display name is unique to this test.

    The shared guest_session fixture always logs in as "Pytest Guest", which
    would collide across tests for the name-matched signals.
    """
    guest = Guest(
        wedding_id=TEST_WEDDING_ID,
        name=progress_guest_name,
        email=f"pytest-guest-progress-{uuid4().hex[:8]}@example.com",
        relationship="friend",
    )
    db_session.add(guest)
    db_session.commit()
    db_session.refresh(guest)

    code = f"PYTEST-PROGRESS-{uuid4().hex[:8].upper()}"
    invite = Invite(
        code=code,
        wedding_id=TEST_WEDDING_ID,
        guest_id=guest.id,
        household_name=f"{progress_guest_name} Household",
        role="guest",
    )
    db_session.add(invite)
    db_session.commit()

    response = client.post("/api/auth/login", json={"invite_code": code})
    assert response.status_code == 200

    try:
        yield client, guest
    finally:
        client.post("/api/auth/logout")
        for model, column in (
            (SongRequest, SongRequest.requested_by),
            (GalleryItem, GalleryItem.uploaded_by),
            (Blessing, Blessing.author_name),
        ):
            db_session.query(model).filter(
                column.like(f"{NAME_PREFIX}%")
            ).delete(synchronize_session=False)
        db_session.query(Invite).filter(Invite.code == code).delete(
            synchronize_session=False
        )
        db_session.query(Guest).filter(Guest.id == guest.id).delete(
            synchronize_session=False
        )
        db_session.commit()


@pytest.fixture()
def set_wedding_phase(db_session: Session) -> Iterator[Callable[[str], None]]:
    """Snapshot the shared seed wedding's phase and restore it afterwards
    (same pattern as test_music.py — the shared DB's phase may be anything)."""
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
def uploads_dir(tmp_path: Path) -> Iterator[Path]:
    """Point UPLOADS_DIR at a temp dir so gallery uploads don't pollute the repo."""
    previous = os.environ.get("UPLOADS_DIR")
    target = tmp_path / "uploads"
    target.mkdir(parents=True, exist_ok=True)
    os.environ["UPLOADS_DIR"] = str(target)
    try:
        yield target
    finally:
        if previous is None:
            os.environ.pop("UPLOADS_DIR", None)
        else:
            os.environ["UPLOADS_DIR"] = previous


def get_progress(session: TestClient) -> dict[str, bool]:
    response = session.get(PROGRESS_URL)
    assert response.status_code == 200
    return response.json()


class TestProgressAuth:
    def test_requires_authentication(self, client: TestClient) -> None:
        assert client.get(PROGRESS_URL).status_code == 401


class TestProgressSignals:
    def test_fresh_guest_has_everything_todo(
        self,
        progress_guest_session: tuple[TestClient, Guest],
    ) -> None:
        session, _ = progress_guest_session
        assert get_progress(session) == ALL_FALSE

    def test_rsvp_flips_after_guest_rsvps(
        self,
        progress_guest_session: tuple[TestClient, Guest],
        set_wedding_phase: Callable[[str], None],
    ) -> None:
        session, guest = progress_guest_session
        assert get_progress(session)["rsvp_submitted"] is False

        set_wedding_phase("live")
        response = session.patch(
            f"/api/guests/{guest.id}", json={"rsvp_status": "accepted"}
        )
        assert response.status_code == 200

        assert get_progress(session)["rsvp_submitted"] is True

    def test_song_flips_after_request(
        self,
        progress_guest_session: tuple[TestClient, Guest],
        set_wedding_phase: Callable[[str], None],
    ) -> None:
        session, _ = progress_guest_session
        assert get_progress(session)["song_requested"] is False

        set_wedding_phase("live")
        response = session.post(
            "/api/music/requests",
            json={"title": "Dancing Queen", "artist": "ABBA"},
        )
        assert response.status_code == 201

        progress = get_progress(session)
        assert progress["song_requested"] is True
        # Other signals stay untouched.
        assert progress["photo_submitted"] is False
        assert progress["blessing_posted"] is False

    def test_photo_flips_after_gallery_submit(
        self,
        progress_guest_session: tuple[TestClient, Guest],
        uploads_dir: Path,
    ) -> None:
        session, _ = progress_guest_session
        assert get_progress(session)["photo_submitted"] is False

        response = session.post(
            "/api/gallery/submit",
            files={"file": ("t.png", TINY_PNG, "image/png")},
            data={"caption": "Progress test"},
        )
        assert response.status_code == 201

        assert get_progress(session)["photo_submitted"] is True

    def test_blessing_flips_after_post(
        self,
        progress_guest_session: tuple[TestClient, Guest],
    ) -> None:
        session, _ = progress_guest_session
        assert get_progress(session)["blessing_posted"] is False

        response = session.post(
            "/api/blessings",
            json={"message": "Wishing you a lifetime of joy!"},
        )
        assert response.status_code == 201

        assert get_progress(session)["blessing_posted"] is True


class TestProgressScoping:
    def test_other_members_rows_do_not_count(
        self,
        progress_guest_session: tuple[TestClient, Guest],
        db_session: Session,
    ) -> None:
        """Rows attributed to a different member never light up my checklist.

        Songs/photos/blessings are name-matched (those tables store display
        names, not guest ids), so scoping means: a different name — even a
        superstring of mine — doesn't count.
        """
        session, guest = progress_guest_session
        other_name = f"{guest.name} Plus One"

        db_session.add_all(
            [
                SongRequest(
                    wedding_id=TEST_WEDDING_ID,
                    title="Somebody Else's Song",
                    requested_by=other_name,
                    status="pending",
                ),
                GalleryItem(
                    wedding_id=TEST_WEDDING_ID,
                    file_path=f"{TEST_WEDDING_ID}/pytest-progress-{uuid4().hex}.png",
                    uploaded_by=other_name,
                    status="pending",
                ),
                Blessing(
                    wedding_id=TEST_WEDDING_ID,
                    author_name=other_name,
                    message="From someone else entirely.",
                ),
            ]
        )
        db_session.commit()

        assert get_progress(session) == ALL_FALSE

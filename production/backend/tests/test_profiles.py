"""Wedding-party mini profiles (Wave 3 item 15).

See docs/specs/WEDDING_PARTY_PROFILES.md for the full contract and
app/api/profiles.py for the implementation under test. Every assertion goes
through the real HTTP API with a real logged-in session.
"""

from __future__ import annotations

import io
from collections.abc import Iterator
from datetime import date
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.db.models import Guest, Invite, MemberProfile, Wedding
from tests.fixtures.guests import TEST_WEDDING_ID, unique_guest_email


TEST_INVITE_PREFIX = "PYTEST-PROFILES"

# A tiny but valid 1x1 PNG (matches tests/test_gallery.py's fixture image).
TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000154a24f3b0000000049454e44ae42"
    "6082"
)


def unique_code(label: str) -> str:
    return f"{TEST_INVITE_PREFIX}-{label}-{uuid4().hex[:8].upper()}"


def make_guest_invite(
    db_session: Session,
    *,
    party: str | None = None,
    party_title: str | None = None,
    name: str = "Pytest Profile Guest",
    wedding_id: int = TEST_WEDDING_ID,
) -> Invite:
    guest = Guest(
        wedding_id=wedding_id,
        name=name,
        email=unique_guest_email("profiles"),
        relationship="friend",
    )
    db_session.add(guest)
    db_session.commit()
    db_session.refresh(guest)

    invite = Invite(
        code=unique_code("GUEST"),
        wedding_id=wedding_id,
        guest_id=guest.id,
        household_name=name,
        role="guest",
        party=party,
        party_title=party_title,
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


def login(client: TestClient, invite: Invite) -> None:
    response = client.post("/api/auth/login", json={"invite_code": invite.code})
    assert response.status_code == 200


@pytest.fixture()
def uploads_dir(tmp_path: Path) -> Iterator[Path]:
    """Point UPLOADS_DIR at a temp dir so the repo isn't polluted."""
    import os

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


@pytest.fixture(autouse=True)
def cleanup_profiles_state(db_session: Session) -> Iterator[None]:
    def _purge() -> None:
        db_session.query(Invite).filter(
            Invite.code.like(f"{TEST_INVITE_PREFIX}-%")
        ).delete(synchronize_session=False)
        db_session.query(Guest).filter(
            Guest.email.like("pytest-guest-profiles-%")
        ).delete(synchronize_session=False)
        db_session.commit()

    _purge()
    yield
    db_session.rollback()
    _purge()


def make_image_bytes(size: tuple[int, int] = (200, 200)) -> bytes:
    image = Image.new("RGB", size, "#7a3b69")
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


# ---------------------------------------------------------------------------
# Eligibility gate
# ---------------------------------------------------------------------------


class TestEligibilityGate:
    def test_get_me_404_when_not_eligible(self, client: TestClient, db_session: Session) -> None:
        invite = make_guest_invite(db_session, party=None)
        login(client, invite)

        response = client.get("/api/profiles/me")
        assert response.status_code == 404

    def test_get_me_200_empty_when_eligible_but_unfilled(
        self, client: TestClient, db_session: Session
    ) -> None:
        invite = make_guest_invite(db_session, party="stag")
        login(client, invite)

        response = client.get("/api/profiles/me")
        assert response.status_code == 200
        body = response.json()
        assert body["invite_id"] == invite.id
        assert body["display_name"] is None
        assert body["about"] is None
        assert body["photo_url"] is None

    def test_put_me_403_when_not_eligible(self, client: TestClient, db_session: Session) -> None:
        invite = make_guest_invite(db_session, party=None)
        login(client, invite)

        response = client.put("/api/profiles/me", json={"display_name": "Sneaky"})
        assert response.status_code == 403

        # And no row should have been created either.
        assert (
            db_session.query(MemberProfile)
            .filter(MemberProfile.invite_id == invite.id)
            .first()
            is None
        )

    def test_photo_upload_403_when_not_eligible(
        self, client: TestClient, db_session: Session, uploads_dir: Path
    ) -> None:
        invite = make_guest_invite(db_session, party=None)
        login(client, invite)

        response = client.post(
            "/api/profiles/me/photo",
            files={"file": ("t.png", TINY_PNG, "image/png")},
        )
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Upsert semantics
# ---------------------------------------------------------------------------


class TestUpsertSemantics:
    def test_first_save_creates_a_row(self, client: TestClient, db_session: Session) -> None:
        invite = make_guest_invite(db_session, party="hen")
        login(client, invite)

        assert (
            db_session.query(MemberProfile)
            .filter(MemberProfile.invite_id == invite.id)
            .first()
            is None
        )

        response = client.put(
            "/api/profiles/me",
            json={
                "display_name": "Hazel's Hen",
                "role_title": "Maid of Honour",
                "about": "Loves karaoke.",
                "best_known_for": "Karaoke champion",
                "favourite_song": "Dancing Queen",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["display_name"] == "Hazel's Hen"
        assert body["role_title"] == "Maid of Honour"
        assert body["about"] == "Loves karaoke."

        db_session.expire_all()
        row = (
            db_session.query(MemberProfile)
            .filter(MemberProfile.invite_id == invite.id)
            .first()
        )
        assert row is not None
        assert row.display_name == "Hazel's Hen"

    def test_second_save_updates_the_same_row(
        self, client: TestClient, db_session: Session
    ) -> None:
        invite = make_guest_invite(db_session, party="stag")
        login(client, invite)

        client.put("/api/profiles/me", json={"display_name": "First Name"})
        client.put("/api/profiles/me", json={"display_name": "Updated Name"})

        db_session.expire_all()
        rows = (
            db_session.query(MemberProfile)
            .filter(MemberProfile.invite_id == invite.id)
            .all()
        )
        assert len(rows) == 1
        assert rows[0].display_name == "Updated Name"

    def test_blank_strings_are_normalized_to_none(
        self, client: TestClient, db_session: Session
    ) -> None:
        invite = make_guest_invite(db_session, party="stag")
        login(client, invite)

        response = client.put(
            "/api/profiles/me",
            json={"display_name": "  ", "about": "   "},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["display_name"] is None
        assert body["about"] is None

    def test_about_field_is_bounded_server_side(
        self, client: TestClient, db_session: Session
    ) -> None:
        invite = make_guest_invite(db_session, party="stag")
        login(client, invite)

        response = client.put(
            "/api/profiles/me",
            json={"about": "x" * 1001},
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Directory
# ---------------------------------------------------------------------------


class TestDirectory:
    def test_directory_includes_unfilled_profiles_with_fallbacks(
        self, client: TestClient, db_session: Session
    ) -> None:
        filled = make_guest_invite(
            db_session, party="stag", party_title="Best Man", name="Filled Member"
        )
        unfilled = make_guest_invite(
            db_session, party="hen", party_title="Maid of Honour", name="Unfilled Member"
        )

        login(client, filled)
        client.put(
            "/api/profiles/me",
            json={"display_name": "Ben the Best Man", "best_known_for": "Great toasts"},
        )
        client.post("/api/auth/logout")

        login(client, unfilled)
        response = client.get("/api/profiles")
        assert response.status_code == 200
        body = response.json()

        by_invite = {entry["invite_id"]: entry for entry in body}
        assert filled.id in by_invite
        assert unfilled.id in by_invite

        filled_entry = by_invite[filled.id]
        assert filled_entry["display_name"] == "Ben the Best Man"
        assert filled_entry["best_known_for"] == "Great toasts"
        assert filled_entry["has_profile"] is True

        unfilled_entry = by_invite[unfilled.id]
        # No saved profile -- falls back to guest name + party title.
        assert unfilled_entry["display_name"] == "Unfilled Member"
        assert unfilled_entry["role_title"] == "Maid of Honour"
        assert unfilled_entry["has_profile"] is False

    def test_directory_excludes_members_without_a_party(
        self, client: TestClient, db_session: Session
    ) -> None:
        non_member = make_guest_invite(db_session, party=None, name="Not In Party")
        eligible = make_guest_invite(db_session, party="stag", name="In Party")
        login(client, eligible)

        response = client.get("/api/profiles")
        assert response.status_code == 200
        ids = {entry["invite_id"] for entry in response.json()}
        assert non_member.id not in ids
        assert eligible.id in ids

    def test_directory_ordered_by_party_then_display_name(
        self, client: TestClient, db_session: Session
    ) -> None:
        viewer = make_guest_invite(db_session, party="stag", name="Zed Viewer")
        make_guest_invite(db_session, party="stag", name="Alpha Stag")
        make_guest_invite(db_session, party="hen", name="Zulu Hen")
        make_guest_invite(db_session, party="hen", name="Alpha Hen")
        login(client, viewer)

        response = client.get("/api/profiles")
        assert response.status_code == 200
        body = response.json()
        # hen sorts before stag alphabetically; within each party,
        # display_name is ascending.
        parties = [entry["party"] for entry in body]
        assert parties == sorted(parties)
        for i in range(len(body) - 1):
            if body[i]["party"] == body[i + 1]["party"]:
                assert body[i]["display_name"].lower() <= body[i + 1]["display_name"].lower()


# ---------------------------------------------------------------------------
# Photo upload validation
# ---------------------------------------------------------------------------


class TestPhotoUpload:
    def test_rejects_non_image_upload(
        self, client: TestClient, db_session: Session, uploads_dir: Path
    ) -> None:
        invite = make_guest_invite(db_session, party="stag")
        login(client, invite)

        response = client.post(
            "/api/profiles/me/photo",
            files={"file": ("notes.txt", b"hello", "text/plain")},
        )
        assert response.status_code == 400

    def test_accepts_image_and_stores_under_profiles_subfolder(
        self, client: TestClient, db_session: Session, uploads_dir: Path
    ) -> None:
        invite = make_guest_invite(db_session, party="stag")
        login(client, invite)

        response = client.post(
            "/api/profiles/me/photo",
            files={"file": ("me.png", make_image_bytes(), "image/png")},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["photo_url"] is not None
        assert f"/{TEST_WEDDING_ID}/profiles/" in body["photo_url"]

        db_session.expire_all()
        row = (
            db_session.query(MemberProfile)
            .filter(MemberProfile.invite_id == invite.id)
            .first()
        )
        assert row is not None
        assert row.photo_path.startswith(f"{TEST_WEDDING_ID}/profiles/")
        assert (uploads_dir / row.photo_path).is_file()


# ---------------------------------------------------------------------------
# Wedding scoping / cross-wedding isolation
#
# member_profiles carries no wedding_id of its own -- only a unique FK to
# invites -- so the directory query must scope by joining through
# Invite.wedding_id. There is no per-invite-id GET in this API's surface
# (only "me" endpoints and the wedding-scoped list), so unlike other
# resources in this codebase there is no literal 404-on-mismatched-id case
# to exercise here; the equivalent risk is a leaky join, tested below.
# ---------------------------------------------------------------------------


class TestCrossWeddingIsolation:
    @pytest.fixture()
    def other_wedding(self, db_session: Session) -> Iterator[Wedding]:
        wedding = Wedding(
            couple_names="Pytest Profiles Other Couple", wedding_date=date(2030, 6, 1)
        )
        db_session.add(wedding)
        db_session.commit()
        db_session.refresh(wedding)
        try:
            yield wedding
        finally:
            db_session.query(Invite).filter(
                Invite.wedding_id == wedding.id
            ).delete(synchronize_session=False)
            db_session.query(Wedding).filter(Wedding.id == wedding.id).delete(
                synchronize_session=False
            )
            db_session.commit()

    def test_directory_excludes_other_weddings_members(
        self, client: TestClient, db_session: Session, other_wedding: Wedding
    ) -> None:
        viewer = make_guest_invite(db_session, party="stag")
        other_member = make_guest_invite(
            db_session,
            party="stag",
            name="Other Wedding Member",
            wedding_id=other_wedding.id,
        )
        login(client, viewer)

        response = client.get("/api/profiles")
        assert response.status_code == 200
        ids = {entry["invite_id"] for entry in response.json()}
        assert other_member.id not in ids

    def test_directory_excludes_other_weddings_saved_profile(
        self, client: TestClient, db_session: Session, other_wedding: Wedding
    ) -> None:
        viewer = make_guest_invite(db_session, party="stag")
        other_member = make_guest_invite(
            db_session,
            party="stag",
            name="Other Wedding Member",
            wedding_id=other_wedding.id,
        )
        other_profile = MemberProfile(
            invite_id=other_member.id, display_name="Should Not Leak"
        )
        db_session.add(other_profile)
        db_session.commit()

        login(client, viewer)
        response = client.get("/api/profiles")
        assert response.status_code == 200
        names = {entry["display_name"] for entry in response.json()}
        assert "Should Not Leak" not in names

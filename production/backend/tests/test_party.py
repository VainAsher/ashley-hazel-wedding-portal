"""Stag & Hen party portals (Wave 3 item 14 D1) — the security-critical
access rule, exercised exhaustively as the spec demands.

Every assertion here goes through the real HTTP API with a real logged-in
session (never a direct call to `has_party_access`) — the whole point of
this suite is proving the *endpoint* enforces the rule, since nav-hiding on
the frontend is not a security boundary.

See docs/specs/PARTY_PORTALS_D1.md "Access rule" and
app/api/party.py::has_party_access / can_toggle_reveal for the contract
under test.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import date
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Guest, Invite, PartyInfo, PartyMessage, PartyReveal, Wedding
from tests.fixtures.guests import TEST_WEDDING_ID, unique_guest_email


TEST_INVITE_PREFIX = "PYTEST-PARTY"


def unique_code(label: str) -> str:
    return f"{TEST_INVITE_PREFIX}-{label}-{uuid4().hex[:8].upper()}"


def make_guest_invite(
    db_session: Session,
    *,
    party: str | None = None,
    party_admin: bool = False,
    party_title: str | None = None,
    name: str = "Pytest Party Guest",
    wedding_id: int = TEST_WEDDING_ID,
) -> Invite:
    guest = Guest(
        wedding_id=wedding_id,
        name=name,
        email=unique_guest_email("party"),
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
        party_admin=party_admin,
        party_title=party_title,
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


def make_couple_invite(
    db_session: Session,
    *,
    associated_party: str | None = None,
    partner_label: str | None = None,
    household_name: str = "Pytest Couple Member",
    wedding_id: int = TEST_WEDDING_ID,
) -> Invite:
    invite = Invite(
        code=unique_code("COUPLE"),
        wedding_id=wedding_id,
        household_name=household_name,
        role="couple",
        associated_party=associated_party,
        partner_label=partner_label,
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


def make_coordinator_invite(db_session: Session, wedding_id: int = TEST_WEDDING_ID) -> Invite:
    invite = Invite(
        code=unique_code("COORD"),
        wedding_id=wedding_id,
        household_name="Pytest Party Coordinator",
        role="coordinator",
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


def login(client: TestClient, invite: Invite) -> None:
    response = client.post("/api/auth/login", json={"invite_code": invite.code})
    assert response.status_code == 200


def set_reveal_row(
    db_session: Session, wedding_id: int, party: str, invite_id: int, revealed: bool
) -> PartyReveal:
    row = PartyReveal(
        wedding_id=wedding_id, party=party, invite_id=invite_id, revealed=revealed
    )
    db_session.add(row)
    db_session.commit()
    db_session.refresh(row)
    return row


def get_reveal_row(
    db_session: Session, wedding_id: int, party: str, invite_id: int
) -> PartyReveal | None:
    return (
        db_session.query(PartyReveal)
        .filter(
            PartyReveal.wedding_id == wedding_id,
            PartyReveal.party == party,
            PartyReveal.invite_id == invite_id,
        )
        .first()
    )


def set_visibility_mode(db_session: Session, mode: str) -> None:
    db_session.expire_all()
    wedding = db_session.get(Wedding, TEST_WEDDING_ID)
    assert wedding is not None
    wedding.party_visibility_mode = mode
    db_session.commit()


@pytest.fixture(autouse=True)
def cleanup_party_state(db_session: Session) -> Iterator[None]:
    original_mode = db_session.get(Wedding, TEST_WEDDING_ID).party_visibility_mode

    def _purge() -> None:
        db_session.query(Invite).filter(
            Invite.code.like(f"{TEST_INVITE_PREFIX}-%")
        ).delete(synchronize_session=False)
        db_session.query(Guest).filter(
            Guest.email.like("pytest-guest-party-%")
        ).delete(synchronize_session=False)
        db_session.query(PartyInfo).filter(
            PartyInfo.wedding_id == TEST_WEDDING_ID
        ).delete(synchronize_session=False)
        db_session.commit()

    _purge()
    yield
    db_session.rollback()
    _purge()
    set_visibility_mode(db_session, original_mode)


# ---------------------------------------------------------------------------
# The access-rule truth table — every branch, hit via the real HTTP endpoint.
# ---------------------------------------------------------------------------


class TestAccessRuleTruthTable:
    # --- guest-role invites ---------------------------------------------

    def test_guest_with_no_party_denied_both_parties(
        self, client: TestClient, db_session: Session
    ) -> None:
        invite = make_guest_invite(db_session, party=None)
        login(client, invite)
        assert client.get("/api/party/stag/summary").status_code == 403
        assert client.get("/api/party/hen/summary").status_code == 403

    def test_guest_of_other_party_denied(self, client: TestClient, db_session: Session) -> None:
        invite = make_guest_invite(db_session, party="stag")
        login(client, invite)
        assert client.get("/api/party/hen/summary").status_code == 403

    def test_guest_of_own_party_allowed(self, client: TestClient, db_session: Session) -> None:
        invite = make_guest_invite(db_session, party="stag")
        login(client, invite)
        assert client.get("/api/party/stag/summary").status_code == 200

    # --- couple-role invites: subject branch -----------------------------

    def test_subject_with_no_row_denied(self, client: TestClient, db_session: Session) -> None:
        invite = make_couple_invite(db_session, associated_party="stag")
        login(client, invite)
        assert client.get("/api/party/stag/summary").status_code == 403

    def test_subject_with_row_false_denied(
        self, client: TestClient, db_session: Session
    ) -> None:
        invite = make_couple_invite(db_session, associated_party="stag")
        set_reveal_row(db_session, TEST_WEDDING_ID, "stag", invite.id, revealed=False)
        login(client, invite)
        assert client.get("/api/party/stag/summary").status_code == 403

    def test_subject_with_row_true_allowed(
        self, client: TestClient, db_session: Session
    ) -> None:
        invite = make_couple_invite(db_session, associated_party="stag")
        set_reveal_row(db_session, TEST_WEDDING_ID, "stag", invite.id, revealed=True)
        login(client, invite)
        assert client.get("/api/party/stag/summary").status_code == 200

    # --- couple-role invites: non-subject branch -------------------------

    def test_non_subject_no_row_partner_visible_allowed(
        self, client: TestClient, db_session: Session
    ) -> None:
        set_visibility_mode(db_session, "partner_visible")
        # associated_party='hen' -> requesting 'stag' makes this invite the
        # non-subject of stag.
        invite = make_couple_invite(db_session, associated_party="hen")
        login(client, invite)
        assert client.get("/api/party/stag/summary").status_code == 200

    def test_non_subject_no_row_locked_denied(
        self, client: TestClient, db_session: Session
    ) -> None:
        set_visibility_mode(db_session, "locked")
        invite = make_couple_invite(db_session, associated_party="hen")
        login(client, invite)
        assert client.get("/api/party/stag/summary").status_code == 403

    @pytest.mark.parametrize("mode", ["partner_visible", "locked"])
    def test_non_subject_row_false_denied_either_mode(
        self, client: TestClient, db_session: Session, mode: str
    ) -> None:
        set_visibility_mode(db_session, mode)
        invite = make_couple_invite(db_session, associated_party="hen")
        set_reveal_row(db_session, TEST_WEDDING_ID, "stag", invite.id, revealed=False)
        login(client, invite)
        assert client.get("/api/party/stag/summary").status_code == 403

    @pytest.mark.parametrize("mode", ["partner_visible", "locked"])
    def test_non_subject_row_true_allowed_either_mode(
        self, client: TestClient, db_session: Session, mode: str
    ) -> None:
        set_visibility_mode(db_session, mode)
        invite = make_couple_invite(db_session, associated_party="hen")
        set_reveal_row(db_session, TEST_WEDDING_ID, "stag", invite.id, revealed=True)
        login(client, invite)
        assert client.get("/api/party/stag/summary").status_code == 200

    # --- coordinators: mechanics yes, content no --------------------------

    def test_coordinator_denied_party_content(
        self, client: TestClient, db_session: Session
    ) -> None:
        invite = make_coordinator_invite(db_session)
        login(client, invite)
        assert client.get("/api/party/stag/summary").status_code == 403
        assert client.get("/api/party/hen/summary").status_code == 403

    def test_coordinator_allowed_settings_mutation(
        self, client: TestClient, db_session: Session
    ) -> None:
        invite = make_coordinator_invite(db_session)
        login(client, invite)
        response = client.put(
            "/api/settings/wedding", json={"party_visibility_mode": "locked"}
        )
        assert response.status_code == 200
        set_visibility_mode(db_session, "partner_visible")

    def test_unauthenticated_denied(self, client: TestClient) -> None:
        assert client.get("/api/party/stag/summary").status_code == 401


class TestPartyAccessEndpoint:
    def test_guest_access_reflects_own_party_only(
        self, client: TestClient, db_session: Session
    ) -> None:
        invite = make_guest_invite(db_session, party="hen")
        login(client, invite)
        data = client.get("/api/party/access").json()
        assert data == {"stag": False, "hen": True}

    def test_coordinator_access_is_false_for_both(
        self, client: TestClient, db_session: Session
    ) -> None:
        invite = make_coordinator_invite(db_session)
        login(client, invite)
        data = client.get("/api/party/access").json()
        assert data == {"stag": False, "hen": False}

    def test_couple_non_subject_access_follows_mode(
        self, client: TestClient, db_session: Session
    ) -> None:
        set_visibility_mode(db_session, "partner_visible")
        invite = make_couple_invite(db_session, associated_party="hen")
        login(client, invite)
        data = client.get("/api/party/access").json()
        assert data == {"stag": True, "hen": False}


class TestCrossWeddingIsolation:
    @pytest.fixture()
    def other_wedding(self, db_session: Session) -> Iterator[Wedding]:
        wedding = Wedding(
            couple_names="Pytest Party Other Couple", wedding_date=date(2030, 6, 1)
        )
        db_session.add(wedding)
        db_session.commit()
        db_session.refresh(wedding)
        try:
            yield wedding
        finally:
            # Raw deletes (not ORM cascade) so the DB's ON DELETE CASCADE
            # from party_messages/party_reveals -> invites -> weddings does
            # the cleanup, rather than the ORM trying to null out invites'
            # NOT NULL wedding_id first.
            db_session.query(Invite).filter(
                Invite.wedding_id == wedding.id
            ).delete(synchronize_session=False)
            db_session.query(Wedding).filter(Wedding.id == wedding.id).delete(
                synchronize_session=False
            )
            db_session.commit()

    def test_reveal_target_from_other_wedding_is_404(
        self, client: TestClient, db_session: Session, other_wedding: Wedding
    ) -> None:
        coordinator = make_coordinator_invite(db_session)
        other_subject = make_couple_invite(
            db_session, associated_party="stag", wedding_id=other_wedding.id
        )
        login(client, coordinator)
        response = client.patch(
            "/api/party/stag/reveal",
            json={"invite_id": other_subject.id, "revealed": True},
        )
        assert response.status_code == 404

    def test_moderate_message_from_other_wedding_is_404(
        self, client: TestClient, db_session: Session, other_wedding: Wedding
    ) -> None:
        other_author = make_couple_invite(db_session, wedding_id=other_wedding.id)
        other_message = PartyMessage(
            wedding_id=other_wedding.id,
            party="stag",
            invite_id=other_author.id,
            message="Hijack attempt",
        )
        db_session.add(other_message)
        db_session.commit()
        db_session.refresh(other_message)

        admin = make_guest_invite(db_session, party="stag", party_admin=True)
        login(client, admin)
        response = client.patch(
            f"/api/party/stag/messages/{other_message.id}", json={"hidden": True}
        )
        assert response.status_code == 404
        db_session.delete(other_message)
        db_session.commit()


# ---------------------------------------------------------------------------
# Party message board: authoring + party-admin pin/hide moderation.
# ---------------------------------------------------------------------------


class TestPartyMessages:
    def test_member_can_post_and_read_own_message(
        self, client: TestClient, db_session: Session
    ) -> None:
        invite = make_guest_invite(db_session, party="stag", name="Pytest Poster")
        login(client, invite)

        response = client.post("/api/party/stag/messages", json={"message": "Let's do this!"})
        assert response.status_code == 201
        body = response.json()
        assert body["message"] == "Let's do this!"
        assert body["author_name"] == "Pytest Poster"
        assert body["hidden"] is False
        assert body["pinned"] is False

        summary = client.get("/api/party/stag/summary").json()
        assert any(m["id"] == body["id"] for m in summary["messages"])

    def test_non_member_cannot_post(self, client: TestClient, db_session: Session) -> None:
        invite = make_guest_invite(db_session, party="hen")
        login(client, invite)
        response = client.post("/api/party/stag/messages", json={"message": "Sneaky"})
        assert response.status_code == 403

    def test_non_admin_does_not_see_hidden_messages(
        self, client: TestClient, db_session: Session
    ) -> None:
        admin = make_guest_invite(db_session, party="stag", party_admin=True)
        member = make_guest_invite(db_session, party="stag", name="Pytest Plain Member")

        db_session.add(
            PartyMessage(
                wedding_id=TEST_WEDDING_ID, party="stag", invite_id=admin.id,
                message="Visible one", hidden=False,
            )
        )
        db_session.add(
            PartyMessage(
                wedding_id=TEST_WEDDING_ID, party="stag", invite_id=admin.id,
                message="Hidden one", hidden=True,
            )
        )
        db_session.commit()

        login(client, member)
        messages = client.get("/api/party/stag/summary").json()["messages"]
        texts = {m["message"] for m in messages}
        assert "Visible one" in texts
        assert "Hidden one" not in texts

    def test_admin_sees_hidden_messages(self, client: TestClient, db_session: Session) -> None:
        admin = make_guest_invite(db_session, party="stag", party_admin=True)
        db_session.add(
            PartyMessage(
                wedding_id=TEST_WEDDING_ID, party="stag", invite_id=admin.id,
                message="Hidden one", hidden=True,
            )
        )
        db_session.commit()

        login(client, admin)
        messages = client.get("/api/party/stag/summary").json()["messages"]
        assert any(m["message"] == "Hidden one" for m in messages)

    def test_party_admin_can_hide_and_pin(self, client: TestClient, db_session: Session) -> None:
        admin = make_guest_invite(db_session, party="stag", party_admin=True)
        member = make_guest_invite(db_session, party="stag", name="Pytest Other Member")
        message = PartyMessage(
            wedding_id=TEST_WEDDING_ID, party="stag", invite_id=member.id, message="Pin me"
        )
        db_session.add(message)
        db_session.commit()
        db_session.refresh(message)

        login(client, admin)
        response = client.patch(
            f"/api/party/stag/messages/{message.id}", json={"pinned": True, "hidden": True}
        )
        assert response.status_code == 200
        assert response.json()["pinned"] is True
        assert response.json()["hidden"] is True

        db_session.expire_all()
        persisted = db_session.get(PartyMessage, message.id)
        assert persisted is not None
        assert persisted.pinned is True
        assert persisted.hidden is True

    def test_non_admin_member_cannot_moderate(
        self, client: TestClient, db_session: Session
    ) -> None:
        member = make_guest_invite(db_session, party="stag")
        message = PartyMessage(
            wedding_id=TEST_WEDDING_ID, party="stag", invite_id=member.id, message="Mine"
        )
        db_session.add(message)
        db_session.commit()
        db_session.refresh(message)

        login(client, member)
        response = client.patch(
            f"/api/party/stag/messages/{message.id}", json={"hidden": True}
        )
        assert response.status_code == 403

    def test_coordinator_cannot_moderate_party_messages(
        self, client: TestClient, db_session: Session
    ) -> None:
        author = make_guest_invite(db_session, party="stag")
        message = PartyMessage(
            wedding_id=TEST_WEDDING_ID, party="stag", invite_id=author.id, message="Mine"
        )
        db_session.add(message)
        db_session.commit()
        db_session.refresh(message)

        coordinator = make_coordinator_invite(db_session)
        login(client, coordinator)
        response = client.patch(
            f"/api/party/stag/messages/{message.id}", json={"hidden": True}
        )
        assert response.status_code == 403

    def test_admin_of_other_party_cannot_moderate(
        self, client: TestClient, db_session: Session
    ) -> None:
        stag_member = make_guest_invite(db_session, party="stag")
        message = PartyMessage(
            wedding_id=TEST_WEDDING_ID, party="stag", invite_id=stag_member.id, message="Mine"
        )
        db_session.add(message)
        db_session.commit()
        db_session.refresh(message)

        hen_admin = make_guest_invite(db_session, party="hen", party_admin=True)
        login(client, hen_admin)
        response = client.patch(
            f"/api/party/stag/messages/{message.id}", json={"hidden": True}
        )
        assert response.status_code == 403


class TestRevealBannerInSummary:
    """The summary's optional reveal_banner is the only place the frontend
    learns the subject's identity/current reveal state — exercised here
    since the Party page's banner+toggle depends on it entirely."""

    def test_non_subject_partner_sees_banner(
        self, client: TestClient, db_session: Session
    ) -> None:
        set_visibility_mode(db_session, "partner_visible")
        subject = make_couple_invite(
            db_session, associated_party="stag", household_name="Ashley"
        )
        non_subject = make_couple_invite(
            db_session, associated_party="hen", household_name="Hazel"
        )
        login(client, non_subject)

        data = client.get("/api/party/stag/summary").json()
        assert data["reveal_banner"] == {
            "subject_invite_id": subject.id,
            "subject_name": "Ashley",
            "revealed": False,
        }

    def test_subject_sees_no_banner(self, client: TestClient, db_session: Session) -> None:
        subject = make_couple_invite(db_session, associated_party="stag")
        set_reveal_row(db_session, TEST_WEDDING_ID, "stag", subject.id, revealed=True)
        login(client, subject)

        data = client.get("/api/party/stag/summary").json()
        assert data["reveal_banner"] is None

    def test_guest_sees_no_banner(self, client: TestClient, db_session: Session) -> None:
        invite = make_guest_invite(db_session, party="stag")
        login(client, invite)
        data = client.get("/api/party/stag/summary").json()
        assert data["reveal_banner"] is None

    def test_banner_reflects_revealed_true(
        self, client: TestClient, db_session: Session
    ) -> None:
        set_visibility_mode(db_session, "partner_visible")
        subject = make_couple_invite(db_session, associated_party="stag")
        set_reveal_row(db_session, TEST_WEDDING_ID, "stag", subject.id, revealed=True)
        non_subject = make_couple_invite(db_session, associated_party="hen")
        login(client, non_subject)

        data = client.get("/api/party/stag/summary").json()
        assert data["reveal_banner"]["revealed"] is True


class TestPartyInfo:
    def test_party_admin_can_set_info(self, client: TestClient, db_session: Session) -> None:
        admin = make_guest_invite(db_session, party="hen", party_admin=True)
        login(client, admin)
        response = client.put("/api/party/hen/info", json={"details": "Saturday, spa day"})
        assert response.status_code == 200
        assert response.json()["details"] == "Saturday, spa day"

        summary = client.get("/api/party/hen/summary").json()
        assert summary["info"]["details"] == "Saturday, spa day"

    def test_non_admin_cannot_set_info(self, client: TestClient, db_session: Session) -> None:
        member = make_guest_invite(db_session, party="hen")
        login(client, member)
        response = client.put("/api/party/hen/info", json={"details": "Nope"})
        assert response.status_code == 403

    def test_coordinator_cannot_set_info(self, client: TestClient, db_session: Session) -> None:
        coordinator = make_coordinator_invite(db_session)
        login(client, coordinator)
        response = client.put("/api/party/hen/info", json={"details": "Nope"})
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# Reveal-toggle authorization matrix.
# ---------------------------------------------------------------------------


class TestRevealToggleAuthorizationMatrix:
    def test_coordinator_can_toggle_subject_row(
        self, client: TestClient, db_session: Session
    ) -> None:
        set_visibility_mode(db_session, "locked")
        subject = make_couple_invite(db_session, associated_party="stag")
        coordinator = make_coordinator_invite(db_session)
        login(client, coordinator)

        response = client.patch(
            "/api/party/stag/reveal", json={"invite_id": subject.id, "revealed": True}
        )
        assert response.status_code == 200

        row = get_reveal_row(db_session, TEST_WEDDING_ID, "stag", subject.id)
        assert row is not None
        assert row.revealed is True

    def test_coordinator_can_toggle_non_subject_own_access_row(
        self, client: TestClient, db_session: Session
    ) -> None:
        set_visibility_mode(db_session, "locked")
        non_subject = make_couple_invite(db_session, associated_party="hen")
        coordinator = make_coordinator_invite(db_session)
        login(client, coordinator)

        response = client.patch(
            "/api/party/stag/reveal", json={"invite_id": non_subject.id, "revealed": True}
        )
        assert response.status_code == 200
        row = get_reveal_row(db_session, TEST_WEDDING_ID, "stag", non_subject.id)
        assert row is not None
        assert row.revealed is True

    def test_party_admin_can_toggle_subject_row(
        self, client: TestClient, db_session: Session
    ) -> None:
        subject = make_couple_invite(db_session, associated_party="stag")
        best_man = make_guest_invite(db_session, party="stag", party_admin=True)
        login(client, best_man)

        response = client.patch(
            "/api/party/stag/reveal", json={"invite_id": subject.id, "revealed": True}
        )
        assert response.status_code == 200
        row = get_reveal_row(db_session, TEST_WEDDING_ID, "stag", subject.id)
        assert row is not None
        assert row.revealed is True

    def test_party_admin_can_toggle_non_subject_row(
        self, client: TestClient, db_session: Session
    ) -> None:
        set_visibility_mode(db_session, "locked")
        non_subject = make_couple_invite(db_session, associated_party="hen")
        best_man = make_guest_invite(db_session, party="stag", party_admin=True)
        login(client, best_man)

        response = client.patch(
            "/api/party/stag/reveal", json={"invite_id": non_subject.id, "revealed": True}
        )
        assert response.status_code == 200

    def test_party_admin_of_wrong_party_cannot_toggle(
        self, client: TestClient, db_session: Session
    ) -> None:
        subject = make_couple_invite(db_session, associated_party="stag")
        hen_admin = make_guest_invite(db_session, party="hen", party_admin=True)
        login(client, hen_admin)

        response = client.patch(
            "/api/party/stag/reveal", json={"invite_id": subject.id, "revealed": True}
        )
        assert response.status_code == 403

    def test_non_subject_partner_can_toggle_subject_row_with_own_access(
        self, client: TestClient, db_session: Session
    ) -> None:
        set_visibility_mode(db_session, "partner_visible")
        subject = make_couple_invite(db_session, associated_party="stag", household_name="Ashley")
        non_subject = make_couple_invite(
            db_session, associated_party="hen", household_name="Hazel"
        )
        login(client, non_subject)

        response = client.patch(
            "/api/party/stag/reveal", json={"invite_id": subject.id, "revealed": True}
        )
        assert response.status_code == 200
        row = get_reveal_row(db_session, TEST_WEDDING_ID, "stag", subject.id)
        assert row is not None
        assert row.revealed is True

    def test_non_subject_partner_denied_without_own_access(
        self, client: TestClient, db_session: Session
    ) -> None:
        set_visibility_mode(db_session, "locked")
        subject = make_couple_invite(db_session, associated_party="stag", household_name="Ashley")
        non_subject = make_couple_invite(
            db_session, associated_party="hen", household_name="Hazel"
        )
        login(client, non_subject)

        response = client.patch(
            "/api/party/stag/reveal", json={"invite_id": subject.id, "revealed": True}
        )
        assert response.status_code == 403
        assert get_reveal_row(db_session, TEST_WEDDING_ID, "stag", subject.id) is None

    def test_non_subject_partner_cannot_toggle_own_row(
        self, client: TestClient, db_session: Session
    ) -> None:
        set_visibility_mode(db_session, "partner_visible")
        non_subject = make_couple_invite(
            db_session, associated_party="hen", household_name="Hazel"
        )
        login(client, non_subject)

        # Hazel (non-subject of stag) tries to toggle her *own* stag access
        # row directly -- only a coordinator or the stag Best Man may do this.
        response = client.patch(
            "/api/party/stag/reveal", json={"invite_id": non_subject.id, "revealed": True}
        )
        assert response.status_code == 403

    def test_subject_partner_cannot_toggle_own_reveal(
        self, client: TestClient, db_session: Session
    ) -> None:
        subject = make_couple_invite(db_session, associated_party="stag", household_name="Ashley")
        login(client, subject)

        response = client.patch(
            "/api/party/stag/reveal", json={"invite_id": subject.id, "revealed": True}
        )
        assert response.status_code == 403
        assert get_reveal_row(db_session, TEST_WEDDING_ID, "stag", subject.id) is None

    def test_random_guest_cannot_toggle(self, client: TestClient, db_session: Session) -> None:
        subject = make_couple_invite(db_session, associated_party="stag")
        random_guest = make_guest_invite(db_session, party="hen")
        login(client, random_guest)

        response = client.patch(
            "/api/party/stag/reveal", json={"invite_id": subject.id, "revealed": True}
        )
        assert response.status_code == 403

    def test_reveal_is_reversible(self, client: TestClient, db_session: Session) -> None:
        subject = make_couple_invite(db_session, associated_party="stag")
        coordinator = make_coordinator_invite(db_session)
        login(client, coordinator)

        client.patch("/api/party/stag/reveal", json={"invite_id": subject.id, "revealed": True})
        row = get_reveal_row(db_session, TEST_WEDDING_ID, "stag", subject.id)
        assert row is not None and row.revealed is True

        response = client.patch(
            "/api/party/stag/reveal", json={"invite_id": subject.id, "revealed": False}
        )
        assert response.status_code == 200
        db_session.expire_all()
        row = get_reveal_row(db_session, TEST_WEDDING_ID, "stag", subject.id)
        assert row is not None and row.revealed is False

    def test_reveal_unknown_invite_is_404(self, client: TestClient, db_session: Session) -> None:
        coordinator = make_coordinator_invite(db_session)
        login(client, coordinator)
        response = client.patch(
            "/api/party/stag/reveal", json={"invite_id": 999999, "revealed": True}
        )
        assert response.status_code == 404

    def test_reveal_target_must_be_couple_role(
        self, client: TestClient, db_session: Session
    ) -> None:
        coordinator = make_coordinator_invite(db_session)
        guest = make_guest_invite(db_session, party="stag")
        login(client, coordinator)
        response = client.patch(
            "/api/party/stag/reveal", json={"invite_id": guest.id, "revealed": True}
        )
        assert response.status_code == 404

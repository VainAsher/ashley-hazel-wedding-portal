"""Wave 3 item 14 D1 extensions to the invite create/update endpoints:
party/party_admin/party_title (guest invites) and partner_label/
associated_party (couple invites), plus the Best Man/Maid of Honour
single-holder-per-party enforcement.

Invites created through the real POST/PATCH /api/invites endpoints get a
server-generated random code (there is no client-supplied code to filter
cleanup by), so this file tracks created invite ids explicitly via the
`invite_ids` fixture rather than a code-prefix sweep.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Guest, Invite
from tests.fixtures.guests import TEST_WEDDING_ID, unique_guest_email


@pytest.fixture()
def invite_ids() -> list[int]:
    return []


@pytest.fixture(autouse=True)
def cleanup_invites(db_session: Session, invite_ids: list[int]) -> Iterator[None]:
    yield
    if invite_ids:
        db_session.query(Invite).filter(Invite.id.in_(invite_ids)).delete(
            synchronize_session=False
        )
        db_session.commit()
    db_session.query(Guest).filter(
        Guest.email.like("pytest-guest-invparty-%")
    ).delete(synchronize_session=False)
    db_session.commit()


def make_guest_row(db_session: Session, name: str = "Pytest InvParty Guest") -> Guest:
    guest = Guest(
        wedding_id=TEST_WEDDING_ID,
        name=name,
        email=unique_guest_email("invparty"),
        relationship="friend",
    )
    db_session.add(guest)
    db_session.commit()
    db_session.refresh(guest)
    return guest


def create_invite(
    couple_session: TestClient, invite_ids: list[int], payload: dict[str, object]
):
    """POST /api/invites and track the created id for teardown, regardless
    of the response status (a rejected 4xx creates nothing to track, but
    calling .json() is still safe either way)."""
    response = couple_session.post("/api/invites", json=payload)
    if response.status_code == 201:
        invite_ids.append(response.json()["id"])
    return response


class TestCreateInviteWithPartyFields:
    def test_create_guest_invite_with_party(
        self, couple_session: TestClient, db_session: Session, invite_ids: list[int]
    ) -> None:
        guest = make_guest_row(db_session)
        response = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "guest",
                "guest_id": guest.id,
                "party": "stag",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["party"] == "stag"
        assert data["party_admin"] is False
        assert data["party_title"] is None

    def test_create_guest_invite_as_party_admin_auto_titles(
        self, couple_session: TestClient, db_session: Session, invite_ids: list[int]
    ) -> None:
        guest = make_guest_row(db_session)
        response = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "guest",
                "guest_id": guest.id,
                "party": "hen",
                "party_admin": True,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["party_admin"] is True
        assert data["party_title"] == "Maid of Honour"

    def test_create_guest_invite_stag_admin_auto_titles_best_man(
        self, couple_session: TestClient, db_session: Session, invite_ids: list[int]
    ) -> None:
        guest = make_guest_row(db_session)
        response = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "guest",
                "guest_id": guest.id,
                "party": "stag",
                "party_admin": True,
            },
        )
        assert response.status_code == 201
        assert response.json()["party_title"] == "Best Man"

    def test_create_guest_invite_custom_title_kept(
        self, couple_session: TestClient, db_session: Session, invite_ids: list[int]
    ) -> None:
        guest = make_guest_row(db_session)
        response = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "guest",
                "guest_id": guest.id,
                "party": "stag",
                "party_admin": True,
                "party_title": "Chief Legend",
            },
        )
        assert response.status_code == 201
        assert response.json()["party_title"] == "Chief Legend"

    def test_party_admin_requires_a_party(
        self, couple_session: TestClient, db_session: Session, invite_ids: list[int]
    ) -> None:
        guest = make_guest_row(db_session)
        response = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "guest",
                "guest_id": guest.id,
                "party_admin": True,
            },
        )
        assert response.status_code == 422

    def test_party_fields_rejected_for_non_guest_role(
        self, couple_session: TestClient, invite_ids: list[int]
    ) -> None:
        response = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "coordinator",
                "party": "stag",
            },
        )
        assert response.status_code == 422

    def test_invalid_party_value_rejected(
        self, couple_session: TestClient, invite_ids: list[int]
    ) -> None:
        response = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "guest",
                "party": "groomsmen",
            },
        )
        assert response.status_code == 422

    def test_create_couple_invite_with_identity_fields(
        self, couple_session: TestClient, invite_ids: list[int]
    ) -> None:
        response = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "couple",
                "partner_label": "Ashley",
                "associated_party": "stag",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["partner_label"] == "Ashley"
        assert data["associated_party"] == "stag"

    def test_couple_identity_fields_rejected_for_guest_role(
        self, couple_session: TestClient, invite_ids: list[int]
    ) -> None:
        response = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "guest",
                "partner_label": "Ashley",
            },
        )
        assert response.status_code == 422


class TestUpdateInviteWithPartyFields:
    def test_update_sets_party(
        self, couple_session: TestClient, db_session: Session, invite_ids: list[int]
    ) -> None:
        guest = make_guest_row(db_session)
        created = create_invite(
            couple_session,
            invite_ids,
            {"wedding_id": TEST_WEDDING_ID, "role": "guest", "guest_id": guest.id},
        ).json()

        response = couple_session.patch(
            f"/api/invites/{created['id']}", json={"party": "hen"}
        )
        assert response.status_code == 200
        assert response.json()["party"] == "hen"

    def test_update_clears_party_with_explicit_null(
        self, couple_session: TestClient, db_session: Session, invite_ids: list[int]
    ) -> None:
        guest = make_guest_row(db_session)
        created = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "guest",
                "guest_id": guest.id,
                "party": "stag",
            },
        ).json()

        response = couple_session.patch(
            f"/api/invites/{created['id']}", json={"party": None}
        )
        assert response.status_code == 200
        assert response.json()["party"] is None

    def test_update_party_admin_without_party_is_rejected(
        self, couple_session: TestClient, db_session: Session, invite_ids: list[int]
    ) -> None:
        guest = make_guest_row(db_session)
        created = create_invite(
            couple_session,
            invite_ids,
            {"wedding_id": TEST_WEDDING_ID, "role": "guest", "guest_id": guest.id},
        ).json()

        response = couple_session.patch(
            f"/api/invites/{created['id']}", json={"party_admin": True}
        )
        assert response.status_code == 422

    def test_update_couple_identity_fields(
        self, couple_session: TestClient, invite_ids: list[int]
    ) -> None:
        created = create_invite(
            couple_session,
            invite_ids,
            {"wedding_id": TEST_WEDDING_ID, "role": "couple"},
        ).json()

        response = couple_session.patch(
            f"/api/invites/{created['id']}",
            json={"partner_label": "Hazel", "associated_party": "hen"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["partner_label"] == "Hazel"
        assert data["associated_party"] == "hen"


class TestBestManSingleHolderEnforcement:
    """Assigning a new Best Man/Maid of Honour clears the previous holder in
    the same transaction — asserted against the DB directly, not just the
    HTTP response, per the spec's security emphasis."""

    def test_assigning_new_party_admin_clears_previous_holder_on_create(
        self, couple_session: TestClient, db_session: Session, invite_ids: list[int]
    ) -> None:
        first_guest = make_guest_row(db_session, name="Pytest First Best Man")
        first = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "guest",
                "guest_id": first_guest.id,
                "party": "stag",
                "party_admin": True,
            },
        ).json()
        assert first["party_admin"] is True

        second_guest = make_guest_row(db_session, name="Pytest Second Best Man")
        second = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "guest",
                "guest_id": second_guest.id,
                "party": "stag",
                "party_admin": True,
            },
        ).json()
        assert second["party_admin"] is True

        db_session.expire_all()
        first_invite = db_session.get(Invite, first["id"])
        second_invite = db_session.get(Invite, second["id"])
        assert first_invite is not None and first_invite.party_admin is False
        assert second_invite is not None and second_invite.party_admin is True
        # The demoted holder's title is cleared too — "Best Man" is
        # meaningless (and confusing) once they no longer hold the role.
        assert first_invite.party_title is None
        assert second_invite.party_title == "Best Man"

    def test_assigning_new_party_admin_clears_previous_holder_on_update(
        self, couple_session: TestClient, db_session: Session, invite_ids: list[int]
    ) -> None:
        first_guest = make_guest_row(db_session, name="Pytest First MoH")
        second_guest = make_guest_row(db_session, name="Pytest Second MoH")

        first = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "guest",
                "guest_id": first_guest.id,
                "party": "hen",
                "party_admin": True,
            },
        ).json()
        second = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "guest",
                "guest_id": second_guest.id,
                "party": "hen",
            },
        ).json()

        response = couple_session.patch(
            f"/api/invites/{second['id']}", json={"party_admin": True}
        )
        assert response.status_code == 200
        assert response.json()["party_admin"] is True

        db_session.expire_all()
        first_invite = db_session.get(Invite, first["id"])
        second_invite = db_session.get(Invite, second["id"])
        assert first_invite is not None and first_invite.party_admin is False
        assert second_invite is not None and second_invite.party_admin is True

    def test_two_different_parties_keep_separate_admins(
        self, couple_session: TestClient, db_session: Session, invite_ids: list[int]
    ) -> None:
        stag_guest = make_guest_row(db_session, name="Pytest Stag Admin")
        hen_guest = make_guest_row(db_session, name="Pytest Hen Admin")

        stag = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "guest",
                "guest_id": stag_guest.id,
                "party": "stag",
                "party_admin": True,
            },
        ).json()
        hen = create_invite(
            couple_session,
            invite_ids,
            {
                "wedding_id": TEST_WEDDING_ID,
                "role": "guest",
                "guest_id": hen_guest.id,
                "party": "hen",
                "party_admin": True,
            },
        ).json()

        db_session.expire_all()
        stag_invite = db_session.get(Invite, stag["id"])
        hen_invite = db_session.get(Invite, hen["id"])
        assert stag_invite is not None and stag_invite.party_admin is True
        assert hen_invite is not None and hen_invite.party_admin is True

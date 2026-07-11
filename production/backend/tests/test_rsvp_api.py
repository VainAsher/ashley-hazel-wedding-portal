from __future__ import annotations

from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Guest, Invite, MenuOption, Wedding
from tests.fixtures.guests import TEST_WEDDING_ID, unique_guest_email


TEST_INVITE_PREFIX = "PYTEST-RSVP"

pytestmark = pytest.mark.usefixtures("clean_test_guests", "clean_test_rsvp_invites")


@pytest.fixture()
def open_meal_selection(db_session: Session) -> Iterator[None]:
    """Open the shared wedding's meal selection with active options matching
    the meal values these tests submit, restoring both afterwards."""
    wedding = db_session.get(Wedding, TEST_WEDDING_ID)
    assert wedding is not None
    original = wedding.meal_selection_open
    wedding.meal_selection_open = True
    options = [
        MenuOption(wedding_id=TEST_WEDDING_ID, name="vegetarian", is_vegetarian=True),
        MenuOption(wedding_id=TEST_WEDDING_ID, name="fish"),
    ]
    db_session.add_all(options)
    db_session.commit()
    try:
        yield
    finally:
        db_session.expire_all()
        wedding = db_session.get(Wedding, TEST_WEDDING_ID)
        if wedding is not None:
            wedding.meal_selection_open = original
        for option in options:
            db_session.delete(option)
        db_session.commit()


@pytest.fixture()
def clean_test_rsvp_invites(db_session: Session) -> Iterator[None]:
    delete_test_rsvp_invites(db_session)
    yield
    delete_test_rsvp_invites(db_session)


def delete_test_rsvp_invites(db_session: Session) -> None:
    db_session.query(Invite).filter(Invite.code.like(f"{TEST_INVITE_PREFIX}-%")).delete(
        synchronize_session=False
    )
    db_session.commit()


def create_rsvp_guest(db_session: Session, name: str = "RSVP Guest") -> Guest:
    guest = Guest(
        wedding_id=TEST_WEDDING_ID,
        name=name,
        email=unique_guest_email("rsvp"),
        relationship="test",
    )
    db_session.add(guest)
    db_session.commit()
    db_session.refresh(guest)
    return guest


def create_rsvp_invite(
    db_session: Session,
    *,
    role: str = "guest",
    guest: Guest | None = None,
    label: str = "INVITE",
) -> Invite:
    invite = Invite(
        code=f"{TEST_INVITE_PREFIX}-{label}-{uuid4().hex[:8].upper()}",
        wedding_id=TEST_WEDDING_ID,
        guest_id=guest.id if guest else None,
        household_name=f"{role.title()} RSVP Household",
        role=role,
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


def login_with_invite(client: TestClient, invite: Invite) -> None:
    response = client.post("/api/auth/login", json={"invite_code": invite.code})
    assert response.status_code == 200


def refresh_guest(db_session: Session, guest_id: int) -> Guest:
    db_session.expire_all()
    guest = db_session.get(Guest, guest_id)
    assert guest is not None
    return guest


class TestRsvpApi:
    def test_guest_can_read_own_guest_state(
        self,
        client: TestClient,
        db_session: Session,
    ) -> None:
        guest = create_rsvp_guest(db_session, name="Own RSVP Read")
        login_with_invite(
            client,
            create_rsvp_invite(db_session, guest=guest, label="OWN-READ"),
        )

        response = client.get(f"/api/guests/{guest.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == guest.id
        assert data["rsvp_status"] == "pending"
        assert data["meal_choice"] is None
        assert data["dietary_notes"] is None

    def test_guest_can_patch_own_rsvp(
        self,
        client: TestClient,
        db_session: Session,
        open_meal_selection: None,
    ) -> None:
        guest = create_rsvp_guest(db_session, name="Own RSVP Patch")
        login_with_invite(
            client,
            create_rsvp_invite(db_session, guest=guest, label="OWN-PATCH"),
        )

        response = client.patch(
            f"/api/guests/{guest.id}",
            json={
                "rsvp_status": "accepted",
                "meal_choice": "vegetarian",
                "dietary_notes": "No nuts",
                "plus_one_name": "Guest Partner",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["rsvp_status"] == "accepted"
        assert data["meal_choice"] == "vegetarian"
        assert data["dietary_notes"] == "No nuts"
        assert data["plus_one_name"] == "Guest Partner"

        persisted = refresh_guest(db_session, guest.id)
        assert getattr(persisted.rsvp_status, "value", persisted.rsvp_status) == "accepted"
        assert persisted.meal_choice == "vegetarian"
        assert persisted.dietary_notes == "No nuts"
        assert persisted.plus_one_name == "Guest Partner"

    @pytest.mark.parametrize("role", ["coordinator", "couple"])
    def test_admin_roles_can_patch_any_guest_rsvp(
        self,
        client: TestClient,
        db_session: Session,
        open_meal_selection: None,
        role: str,
    ) -> None:
        guest = create_rsvp_guest(db_session, name=f"{role.title()} RSVP Target")
        login_with_invite(
            client,
            create_rsvp_invite(db_session, role=role, label=f"{role.upper()}-PATCH"),
        )

        response = client.patch(
            f"/api/guests/{guest.id}",
            json={"rsvp_status": "tentative", "meal_choice": "fish"},
        )

        assert response.status_code == 200
        assert response.json()["rsvp_status"] == "tentative"
        assert response.json()["meal_choice"] == "fish"

    def test_guest_cannot_read_another_guest_state(
        self,
        client: TestClient,
        db_session: Session,
    ) -> None:
        guest = create_rsvp_guest(db_session, name="Allowed RSVP Guest")
        other_guest = create_rsvp_guest(db_session, name="Denied RSVP Guest")
        login_with_invite(
            client,
            create_rsvp_invite(db_session, guest=guest, label="OTHER-READ"),
        )

        response = client.get(f"/api/guests/{other_guest.id}")

        assert response.status_code == 403
        assert response.json() == {"detail": "Cannot access another guest RSVP"}

    def test_guest_cannot_patch_another_guest_rsvp(
        self,
        client: TestClient,
        db_session: Session,
    ) -> None:
        guest = create_rsvp_guest(db_session, name="Allowed RSVP Patch")
        other_guest = create_rsvp_guest(db_session, name="Denied RSVP Patch")
        login_with_invite(
            client,
            create_rsvp_invite(db_session, guest=guest, label="OTHER-PATCH"),
        )

        response = client.patch(
            f"/api/guests/{other_guest.id}",
            json={"rsvp_status": "declined"},
        )

        assert response.status_code == 403
        assert response.json() == {"detail": "Cannot access another guest RSVP"}

    def test_unauthenticated_rsvp_patch_returns_401(
        self,
        client: TestClient,
        db_session: Session,
    ) -> None:
        guest = create_rsvp_guest(db_session, name="Unauthenticated RSVP")

        response = client.patch(
            f"/api/guests/{guest.id}",
            json={"rsvp_status": "accepted"},
        )

        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    def test_invalid_rsvp_status_rejected(
        self,
        client: TestClient,
        db_session: Session,
    ) -> None:
        guest = create_rsvp_guest(db_session, name="Invalid RSVP Status")
        login_with_invite(
            client,
            create_rsvp_invite(db_session, role="coordinator", label="BAD-STATUS"),
        )

        response = client.patch(
            f"/api/guests/{guest.id}",
            json={"rsvp_status": "maybe"},
        )

        assert response.status_code == 422

    def test_invalid_meal_choice_rejected(
        self,
        client: TestClient,
        db_session: Session,
        open_meal_selection: None,
    ) -> None:
        # Even while meal selection is open, the value must name an active
        # menu option for this wedding.
        guest = create_rsvp_guest(db_session, name="Invalid RSVP Meal")
        login_with_invite(
            client,
            create_rsvp_invite(db_session, role="coordinator", label="BAD-MEAL"),
        )

        response = client.patch(
            f"/api/guests/{guest.id}",
            json={"meal_choice": "steak"},
        )

        assert response.status_code == 422

    def test_meal_choice_rejected_while_selection_closed(
        self,
        client: TestClient,
        db_session: Session,
    ) -> None:
        # No open_meal_selection fixture: the shared wedding default is closed,
        # mirroring how the phase gate rejects with an explicit 403.
        guest = create_rsvp_guest(db_session, name="Closed RSVP Meal")
        login_with_invite(
            client,
            create_rsvp_invite(db_session, guest=guest, label="CLOSED-MEAL"),
        )

        response = client.patch(
            f"/api/guests/{guest.id}",
            json={"rsvp_status": "accepted", "meal_choice": "fish"},
        )

        assert response.status_code == 403
        assert response.json() == {"detail": "Meal selection is not currently open."}

    def test_dietary_notes_length_rejected(
        self,
        client: TestClient,
        db_session: Session,
    ) -> None:
        guest = create_rsvp_guest(db_session, name="Long RSVP Notes")
        login_with_invite(
            client,
            create_rsvp_invite(db_session, role="coordinator", label="LONG-NOTES"),
        )

        response = client.patch(
            f"/api/guests/{guest.id}",
            json={"dietary_notes": "x" * 501},
        )

        assert response.status_code == 422

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Guest, Invite
from tests.fixtures.guests import TEST_WEDDING_ID, unique_guest_email


TEST_INVITE_PREFIX = "PYTEST-AUTH"


@pytest.fixture()
def clean_test_auth_data(db_session: Session) -> Iterator[None]:
    delete_test_auth_data(db_session)
    yield
    delete_test_auth_data(db_session)


def delete_test_auth_data(db_session: Session) -> None:
    db_session.query(Invite).filter(Invite.code.like(f"{TEST_INVITE_PREFIX}-%")).delete(
        synchronize_session=False
    )
    db_session.query(Guest).filter(Guest.email.like("pytest-guest-auth-%")).delete(
        synchronize_session=False
    )
    db_session.commit()


def create_auth_guest(db_session: Session, name: str = "Auth Guest") -> Guest:
    guest = Guest(
        wedding_id=TEST_WEDDING_ID,
        name=name,
        email=unique_guest_email("auth"),
        relationship="test",
    )
    db_session.add(guest)
    db_session.commit()
    db_session.refresh(guest)
    return guest


def create_invite(
    db_session: Session,
    code: str,
    role: str = "guest",
    guest: Guest | None = None,
    household_name: str = "Auth Household",
) -> Invite:
    invite = Invite(
        code=code,
        wedding_id=TEST_WEDDING_ID,
        guest_id=guest.id if guest else None,
        household_name=household_name,
        role=role,
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


class TestAuthRoutes:
    def test_login_valid_guest_invite_sets_session_cookie(
        self,
        client: TestClient,
        db_session: Session,
        clean_test_auth_data: None,
    ) -> None:
        guest = create_auth_guest(db_session)
        create_invite(db_session, f"{TEST_INVITE_PREFIX}-VALID", guest=guest)

        response = client.post(
            "/api/auth/login",
            json={"invite_code": f"{TEST_INVITE_PREFIX}-VALID"},
        )

        assert response.status_code == 200
        assert response.json() == {
            "message": "Login successful",
            "user": {
                "id": guest.id,
                "guest_id": guest.id,
                "invite_id": response.json()["user"]["invite_id"],
                "name": guest.name,
                "role": "guest",
                "wedding_id": TEST_WEDDING_ID,
            },
        }
        assert "session" in client.cookies

    def test_login_normalizes_invite_code(
        self,
        client: TestClient,
        db_session: Session,
        clean_test_auth_data: None,
    ) -> None:
        guest = create_auth_guest(db_session)
        create_invite(db_session, f"{TEST_INVITE_PREFIX}-CASE", guest=guest)

        response = client.post(
            "/api/auth/login",
            json={"invite_code": f"  {TEST_INVITE_PREFIX.lower()}-case  "},
        )

        assert response.status_code == 200
        assert response.json()["user"]["guest_id"] == guest.id

    def test_login_invalid_invite_returns_401(self, client: TestClient) -> None:
        response = client.post(
            "/api/auth/login",
            json={"invite_code": f"{TEST_INVITE_PREFIX}-MISSING"},
        )

        assert response.status_code == 401
        assert response.json() == {"detail": "Invalid invite code"}

    def test_login_blank_invite_code_returns_422(self, client: TestClient) -> None:
        response = client.post("/api/auth/login", json={"invite_code": "   "})

        assert response.status_code == 422

    def test_login_role_invite_without_guest_uses_household_identity(
        self,
        client: TestClient,
        db_session: Session,
        clean_test_auth_data: None,
    ) -> None:
        invite = create_invite(
            db_session,
            f"{TEST_INVITE_PREFIX}-COUPLE",
            role="couple",
            household_name="Ashley & Hazel",
        )

        response = client.post(
            "/api/auth/login",
            json={"invite_code": f"{TEST_INVITE_PREFIX}-COUPLE"},
        )

        assert response.status_code == 200
        assert response.json()["user"] == {
            "id": invite.id,
            "guest_id": None,
            "invite_id": invite.id,
            "name": "Ashley & Hazel",
            "role": "couple",
            "wedding_id": TEST_WEDDING_ID,
        }

    def test_me_returns_current_session_user(
        self,
        client: TestClient,
        db_session: Session,
        clean_test_auth_data: None,
    ) -> None:
        guest = create_auth_guest(db_session)
        invite = create_invite(db_session, f"{TEST_INVITE_PREFIX}-ME", guest=guest)
        client.post("/api/auth/login", json={"invite_code": invite.code})

        response = client.get("/api/auth/me")

        assert response.status_code == 200
        assert response.json()["guest_id"] == guest.id
        assert response.json()["role"] == "guest"

    def test_me_without_session_returns_401(self, client: TestClient) -> None:
        response = client.get("/api/auth/me")

        assert response.status_code == 401
        assert response.json() == {"detail": "Not authenticated"}

    def test_logout_clears_session(
        self,
        client: TestClient,
        db_session: Session,
        clean_test_auth_data: None,
    ) -> None:
        guest = create_auth_guest(db_session)
        invite = create_invite(db_session, f"{TEST_INVITE_PREFIX}-LOGOUT", guest=guest)
        client.post("/api/auth/login", json={"invite_code": invite.code})

        logout_response = client.post("/api/auth/logout")
        me_response = client.get("/api/auth/me")

        assert logout_response.status_code == 200
        assert logout_response.json() == {"message": "Logout successful"}
        assert me_response.status_code == 401

    def test_multiple_logins_same_invite_are_allowed(
        self,
        client: TestClient,
        db_session: Session,
        clean_test_auth_data: None,
    ) -> None:
        guest = create_auth_guest(db_session)
        invite = create_invite(db_session, f"{TEST_INVITE_PREFIX}-REUSE", guest=guest)

        first_response = client.post("/api/auth/login", json={"invite_code": invite.code})
        second_response = client.post("/api/auth/login", json={"invite_code": invite.code})

        assert first_response.status_code == 200
        assert second_response.status_code == 200

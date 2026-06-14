from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

os.environ.setdefault("DATABASE_URL", "postgresql://localhost/wedding")

from app.db.database import SessionLocal  # noqa: E402
from app.db.models import Guest, Invite, RsvpStatus  # noqa: E402
from app.main import app  # noqa: E402
from tests.fixtures.guests import (  # noqa: E402
    TEST_EMAIL_PREFIX,
    TEST_WEDDING_ID,
    budget_payload as build_budget_payload,
    copy_payload,
    guest_batch,
    guest_payload as build_guest_payload,
    vendor_payload as build_vendor_payload,
)


@pytest.fixture()
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def db_session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def clean_test_guests(db_session: Session) -> Iterator[None]:
    delete_test_guests(db_session)
    yield
    delete_test_guests(db_session)


def delete_test_guests(db_session: Session) -> None:
    db_session.query(Guest).filter(Guest.email.like(f"{TEST_EMAIL_PREFIX}%")).delete(
        synchronize_session=False
    )
    db_session.commit()


def delete_test_auth_invites(db_session: Session) -> None:
    db_session.query(Invite).filter(Invite.code.like("PYTEST-FIXTURE-%")).delete(
        synchronize_session=False
    )
    db_session.commit()


@pytest.fixture()
def authorized_client(
    client: TestClient,
    db_session: Session,
) -> Iterator[TestClient]:
    code = f"PYTEST-FIXTURE-COORD-{uuid4().hex[:8].upper()}"
    invite = Invite(
        code=code,
        wedding_id=TEST_WEDDING_ID,
        household_name="Pytest Coordinator",
        role="coordinator",
    )
    db_session.add(invite)
    db_session.commit()

    response = client.post("/api/auth/login", json={"invite_code": code})
    assert response.status_code == 200

    try:
        yield client
    finally:
        client.post("/api/auth/logout")
        cleanup_session = SessionLocal()
        try:
            delete_test_auth_invites(cleanup_session)
        finally:
            cleanup_session.close()


@pytest.fixture()
def wedding_id() -> int:
    return TEST_WEDDING_ID


@pytest.fixture()
def sample_guest_payload() -> dict[str, object]:
    return build_guest_payload()


@pytest.fixture()
def sample_vendor_payload() -> dict[str, object]:
    return build_vendor_payload()


@pytest.fixture()
def sample_budget_payload() -> dict[str, object]:
    return build_budget_payload()


@pytest.fixture()
def guest_payload_factory() -> Callable[..., dict[str, object]]:
    return build_guest_payload


@pytest.fixture()
def coordinator_session(
    client: TestClient,
    db_session: Session,
) -> TestClient:
    """Return a test client authenticated as a coordinator."""
    from uuid import uuid4
    code = f"PYTEST-COORD-{uuid4().hex[:8].upper()}"
    invite = Invite(
        code=code,
        wedding_id=TEST_WEDDING_ID,
        household_name="Pytest Coordinator",
        role="coordinator",
    )
    db_session.add(invite)
    db_session.commit()

    response = client.post("/api/auth/login", json={"invite_code": code})
    assert response.status_code == 200
    return client


@pytest.fixture()
def guest_session(
    client: TestClient,
    db_session: Session,
) -> TestClient:
    """Return a test client authenticated as a guest."""
    from uuid import uuid4
    guest = Guest(
        wedding_id=TEST_WEDDING_ID,
        name="Pytest Guest",
        email=f"pytest-guest-{uuid4().hex[:8]}@example.com",
        relationship="friend",
    )
    db_session.add(guest)
    db_session.commit()
    db_session.refresh(guest)

    code = f"PYTEST-GUEST-{uuid4().hex[:8].upper()}"
    invite = Invite(
        code=code,
        wedding_id=TEST_WEDDING_ID,
        guest_id=guest.id,
        household_name="Pytest Guest Household",
        role="guest",
    )
    db_session.add(invite)
    db_session.commit()

    response = client.post("/api/auth/login", json={"invite_code": code})
    assert response.status_code == 200
    return client


@pytest.fixture()
def sample_guest(
    db_session: Session,
    clean_test_guests: None,
    sample_guest_payload: dict[str, object],
) -> Guest:
    guest = Guest(**copy_payload(sample_guest_payload, rsvp_status=RsvpStatus.pending))
    db_session.add(guest)
    db_session.commit()
    db_session.refresh(guest)
    return guest


@pytest.fixture()
def multiple_guests(db_session: Session, clean_test_guests: None) -> list[Guest]:
    guests = [
        Guest(
            **copy_payload(
                payload,
                rsvp_status=RsvpStatus(str(payload["rsvp_status"])),
            )
        )
        for payload in guest_batch()
    ]
    db_session.add_all(guests)
    db_session.commit()
    for guest in guests:
        db_session.refresh(guest)
    return guests


@pytest.fixture()
def create_guest_via_api(
    authorized_client: TestClient,
    clean_test_guests: None,
    guest_payload_factory: Callable[..., dict[str, object]],
) -> Callable[..., dict[str, object]]:
    def create_guest(**overrides: object) -> dict[str, object]:
        response = authorized_client.post(
            "/api/guests",
            json=guest_payload_factory(**overrides),
        )
        assert response.status_code == 201
        return response.json()

    return create_guest

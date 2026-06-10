from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.db.models import Guest
from app.main import app


client = TestClient(app)
TEST_EMAIL_PREFIX = "pytest-guest"
WEDDING_ID = 1


@pytest.fixture(autouse=True)
def clean_test_guests() -> Iterator[None]:
    delete_test_guests()
    yield
    delete_test_guests()


def delete_test_guests() -> None:
    db = SessionLocal()
    try:
        db.query(Guest).filter(Guest.email.like(f"{TEST_EMAIL_PREFIX}%")).delete(
            synchronize_session=False
        )
        db.commit()
    finally:
        db.close()


def guest_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "wedding_id": WEDDING_ID,
        "name": "Pytest Guest",
        "email": f"{TEST_EMAIL_PREFIX}@example.com",
        "phone": "555-0199",
        "relationship": "test",
    }
    payload.update(overrides)
    return payload


def create_guest(**overrides: object) -> dict[str, object]:
    response = client.post("/api/guests", json=guest_payload(**overrides))
    assert response.status_code == 201
    return response.json()


def test_create_guest() -> None:
    data = create_guest(name="Create Test Guest")

    assert data["id"] > 0
    assert data["wedding_id"] == WEDDING_ID
    assert data["name"] == "Create Test Guest"
    assert data["email"] == f"{TEST_EMAIL_PREFIX}@example.com"
    assert data["rsvp_status"] == "pending"


def test_list_guests() -> None:
    guest = create_guest(email=f"{TEST_EMAIL_PREFIX}-list@example.com")

    response = client.get("/api/guests")

    assert response.status_code == 200
    assert any(item["id"] == guest["id"] for item in response.json())


def test_get_guest() -> None:
    guest = create_guest(email=f"{TEST_EMAIL_PREFIX}-get@example.com")

    response = client.get(f"/api/guests/{guest['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == guest["id"]


def test_update_guest() -> None:
    guest = create_guest(email=f"{TEST_EMAIL_PREFIX}-update@example.com")

    response = client.put(
        f"/api/guests/{guest['id']}",
        json={"rsvp_status": "accepted", "notes": "Updated by pytest"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["rsvp_status"] == "accepted"
    assert data["notes"] == "Updated by pytest"


def test_delete_guest() -> None:
    guest = create_guest(email=f"{TEST_EMAIL_PREFIX}-delete@example.com")

    response = client.delete(f"/api/guests/{guest['id']}")

    assert response.status_code == 200
    assert response.json() == {"status": "deleted", "id": guest["id"]}

    missing_response = client.get(f"/api/guests/{guest['id']}")
    assert missing_response.status_code == 404


def test_invalid_email() -> None:
    response = client.post("/api/guests", json=guest_payload(email="not-an-email"))

    assert response.status_code == 422


def test_guest_not_found() -> None:
    response = client.get("/api/guests/999999")

    assert response.status_code == 404


def test_missing_wedding_returns_400() -> None:
    response = client.post("/api/guests", json=guest_payload(wedding_id=999999))

    assert response.status_code == 400
    assert response.json()["detail"] == "Wedding not found"

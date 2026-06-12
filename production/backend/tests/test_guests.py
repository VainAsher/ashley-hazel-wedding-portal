from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient


def test_create_guest(
    create_guest_via_api: Callable[..., dict[str, object]],
    wedding_id: int,
) -> None:
    data = create_guest_via_api(name="Create Test Guest")

    assert data["id"] > 0
    assert data["wedding_id"] == wedding_id
    assert data["name"] == "Create Test Guest"
    assert str(data["email"]).startswith("pytest-guest-")
    assert data["rsvp_status"] == "pending"


def test_list_guests(
    authorized_client: TestClient,
    create_guest_via_api: Callable[..., dict[str, object]],
) -> None:
    guest = create_guest_via_api(name="List Test Guest")

    response = authorized_client.get("/api/guests")

    assert response.status_code == 200
    assert any(item["id"] == guest["id"] for item in response.json())


def test_get_guest(
    authorized_client: TestClient,
    create_guest_via_api: Callable[..., dict[str, object]],
) -> None:
    guest = create_guest_via_api(name="Get Test Guest")

    response = authorized_client.get(f"/api/guests/{guest['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == guest["id"]


def test_update_guest(
    authorized_client: TestClient,
    create_guest_via_api: Callable[..., dict[str, object]],
) -> None:
    guest = create_guest_via_api(name="Update Test Guest")

    response = authorized_client.put(
        f"/api/guests/{guest['id']}",
        json={"rsvp_status": "accepted", "notes": "Updated by pytest"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["rsvp_status"] == "accepted"
    assert data["notes"] == "Updated by pytest"


def test_delete_guest(
    authorized_client: TestClient,
    create_guest_via_api: Callable[..., dict[str, object]],
) -> None:
    guest = create_guest_via_api(name="Delete Test Guest")

    response = authorized_client.delete(f"/api/guests/{guest['id']}")

    assert response.status_code == 200
    assert response.json() == {"status": "deleted", "id": guest["id"]}

    missing_response = authorized_client.get(f"/api/guests/{guest['id']}")
    assert missing_response.status_code == 404


def test_invalid_email(
    authorized_client: TestClient,
    guest_payload_factory: Callable[..., dict[str, object]],
) -> None:
    response = authorized_client.post(
        "/api/guests",
        json=guest_payload_factory(email="not-an-email"),
    )

    assert response.status_code == 422


def test_guest_not_found(authorized_client: TestClient) -> None:
    response = authorized_client.get("/api/guests/999999")

    assert response.status_code == 404


def test_missing_wedding_returns_400(
    authorized_client: TestClient,
    guest_payload_factory: Callable[..., dict[str, object]],
) -> None:
    response = authorized_client.post(
        "/api/guests",
        json=guest_payload_factory(wedding_id=999999),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Wedding not found"

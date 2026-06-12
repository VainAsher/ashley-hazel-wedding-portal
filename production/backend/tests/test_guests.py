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
    client: TestClient,
    create_guest_via_api: Callable[..., dict[str, object]],
) -> None:
    guest = create_guest_via_api(name="List Test Guest")

    response = client.get("/api/guests")

    assert response.status_code == 200
    assert any(item["id"] == guest["id"] for item in response.json())


def test_get_guest(
    client: TestClient,
    create_guest_via_api: Callable[..., dict[str, object]],
) -> None:
    guest = create_guest_via_api(name="Get Test Guest")

    response = client.get(f"/api/guests/{guest['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == guest["id"]


def test_update_guest(
    client: TestClient,
    create_guest_via_api: Callable[..., dict[str, object]],
) -> None:
    guest = create_guest_via_api(name="Update Test Guest")

    response = client.put(
        f"/api/guests/{guest['id']}",
        json={"rsvp_status": "accepted", "notes": "Updated by pytest"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["rsvp_status"] == "accepted"
    assert data["notes"] == "Updated by pytest"


def test_delete_guest(
    client: TestClient,
    create_guest_via_api: Callable[..., dict[str, object]],
) -> None:
    guest = create_guest_via_api(name="Delete Test Guest")

    response = client.delete(f"/api/guests/{guest['id']}")

    assert response.status_code == 200
    assert response.json() == {"status": "deleted", "id": guest["id"]}

    missing_response = client.get(f"/api/guests/{guest['id']}")
    assert missing_response.status_code == 404


def test_invalid_email(
    client: TestClient,
    guest_payload_factory: Callable[..., dict[str, object]],
) -> None:
    response = client.post(
        "/api/guests",
        json=guest_payload_factory(email="not-an-email"),
    )

    assert response.status_code == 422


def test_guest_not_found(client: TestClient) -> None:
    response = client.get("/api/guests/999999")

    assert response.status_code == 404


def test_missing_wedding_returns_400(
    client: TestClient,
    guest_payload_factory: Callable[..., dict[str, object]],
) -> None:
    response = client.post(
        "/api/guests",
        json=guest_payload_factory(wedding_id=999999),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Wedding not found"

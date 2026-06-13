from __future__ import annotations

from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Guest, Invite
from app.main import app


pytestmark = pytest.mark.usefixtures("clean_test_guests")


def fetch_guest(db_session: Session, guest_id: int) -> Guest | None:
    db_session.expire_all()
    return db_session.get(Guest, guest_id)


def create_guest(
    authorized_client: TestClient,
    guest_payload_factory: Callable[..., dict[str, object]],
    **overrides: object,
) -> dict[str, object]:
    response = authorized_client.post("/api/guests", json=guest_payload_factory(**overrides))
    assert response.status_code == 201
    return response.json()


class TestGuestIntegration:
    def test_full_guest_lifecycle(
        self,
        authorized_client: TestClient,
        db_session: Session,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        created = create_guest(
            authorized_client,
            guest_payload_factory,
            name="Lifecycle Guest",
            rsvp_status="pending",
        )
        guest_id = int(created["id"])

        read_response = authorized_client.get(f"/api/guests/{guest_id}")
        assert read_response.status_code == 200
        assert read_response.json()["name"] == "Lifecycle Guest"

        update_response = authorized_client.put(
            f"/api/guests/{guest_id}",
            json={"rsvp_status": "accepted", "notes": "Lifecycle updated"},
        )
        assert update_response.status_code == 200
        assert update_response.json()["rsvp_status"] == "accepted"

        persisted = fetch_guest(db_session, guest_id)
        assert persisted is not None
        assert getattr(persisted.rsvp_status, "value", persisted.rsvp_status) == "accepted"
        assert persisted.notes == "Lifecycle updated"

        delete_response = authorized_client.delete(f"/api/guests/{guest_id}")
        assert delete_response.status_code == 200
        assert fetch_guest(db_session, guest_id) is None

        missing_response = authorized_client.get(f"/api/guests/{guest_id}")
        assert missing_response.status_code == 404

    def test_create_guest_persists_required_fields(
        self,
        authorized_client: TestClient,
        db_session: Session,
        guest_payload_factory: Callable[..., dict[str, object]],
        wedding_id: int,
    ) -> None:
        created = create_guest(authorized_client, guest_payload_factory, name="Required Fields")

        persisted = fetch_guest(db_session, int(created["id"]))
        assert persisted is not None
        assert persisted.wedding_id == wedding_id
        assert persisted.name == "Required Fields"
        assert persisted.email == created["email"]

    def test_create_guest_persists_optional_fields(
        self,
        authorized_client: TestClient,
        db_session: Session,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        created = create_guest(
            authorized_client,
            guest_payload_factory,
            name="Optional Fields",
            dietary_restrictions="Vegetarian",
            relationship="family",
            phone="555-0111",
        )

        persisted = fetch_guest(db_session, int(created["id"]))
        assert persisted is not None
        assert persisted.dietary_restrictions == "Vegetarian"
        assert persisted.relationship == "family"
        assert persisted.phone == "555-0111"

    def test_update_guest_persists_status_and_notes(
        self,
        authorized_client: TestClient,
        db_session: Session,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        created = create_guest(authorized_client, guest_payload_factory, name="Update Status")

        response = authorized_client.put(
            f"/api/guests/{created['id']}",
            json={"rsvp_status": "declined", "notes": "Cannot attend"},
        )

        assert response.status_code == 200
        persisted = fetch_guest(db_session, int(created["id"]))
        assert persisted is not None
        assert getattr(persisted.rsvp_status, "value", persisted.rsvp_status) == "declined"
        assert persisted.notes == "Cannot attend"

    def test_update_guest_can_set_table_assignment(
        self,
        authorized_client: TestClient,
        db_session: Session,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        created = create_guest(authorized_client, guest_payload_factory, name="Table Assignment")

        response = authorized_client.put(
            f"/api/guests/{created['id']}",
            json={"table_number": 4, "seat_number": 2},
        )

        assert response.status_code == 200
        persisted = fetch_guest(db_session, int(created["id"]))
        assert persisted is not None
        assert persisted.table_number == 4
        assert persisted.seat_number == 2

    def test_update_guest_can_clear_optional_notes(
        self,
        authorized_client: TestClient,
        db_session: Session,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        created = create_guest(authorized_client, guest_payload_factory, notes="Temporary note")

        response = authorized_client.put(f"/api/guests/{created['id']}", json={"notes": None})

        assert response.status_code == 200
        persisted = fetch_guest(db_session, int(created["id"]))
        assert persisted is not None
        assert persisted.notes is None

    def test_delete_guest_removes_database_row(
        self,
        authorized_client: TestClient,
        db_session: Session,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        created = create_guest(authorized_client, guest_payload_factory, name="Delete Persisted")

        response = authorized_client.delete(f"/api/guests/{created['id']}")

        assert response.status_code == 200
        assert fetch_guest(db_session, int(created["id"])) is None

    def test_list_guests_includes_api_created_records(
        self,
        authorized_client: TestClient,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        guests = [
            create_guest(authorized_client, guest_payload_factory, name=f"List Guest {index}")
            for index in range(3)
        ]

        response = authorized_client.get("/api/guests")

        assert response.status_code == 200
        returned_ids = {guest["id"] for guest in response.json()}
        assert {guest["id"] for guest in guests}.issubset(returned_ids)

    def test_list_guests_respects_limit(
        self,
        authorized_client: TestClient,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        for index in range(3):
            create_guest(authorized_client, guest_payload_factory, name=f"Limit Guest {index}")

        response = authorized_client.get("/api/guests?limit=2")

        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_list_guests_respects_skip(
        self,
        authorized_client: TestClient,
        db_session: Session,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        existing_count = db_session.query(Guest).count()
        first = create_guest(authorized_client, guest_payload_factory, name="Skip First")
        second = create_guest(authorized_client, guest_payload_factory, name="Skip Second")

        response = authorized_client.get(f"/api/guests?skip={existing_count + 1}&limit=1")

        assert response.status_code == 200
        returned = response.json()
        assert len(returned) == 1
        assert returned[0]["id"] != first["id"]
        assert returned[0]["id"] == second["id"]

    def test_get_guest_returns_created_payload(
        self,
        authorized_client: TestClient,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        created = create_guest(authorized_client, guest_payload_factory, name="Read Payload")

        response = authorized_client.get(f"/api/guests/{created['id']}")

        assert response.status_code == 200
        assert response.json()["email"] == created["email"]
        assert response.json()["name"] == "Read Payload"

    def test_duplicate_email_rejected_end_to_end(
        self,
        authorized_client: TestClient,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        email = str(guest_payload_factory()["email"])
        first_payload = guest_payload_factory(email=email, name="Duplicate One")
        second_payload = guest_payload_factory(email=email, name="Duplicate Two")

        assert authorized_client.post("/api/guests", json=first_payload).status_code == 201
        response = authorized_client.post("/api/guests", json=second_payload)

        assert response.status_code == 400
        assert response.json()["detail"] == "Guest email already exists for this wedding"

    def test_invalid_email_rejected_before_db_insert(
        self,
        authorized_client: TestClient,
        db_session: Session,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        before_count = db_session.query(Guest).count()

        response = authorized_client.post(
            "/api/guests",
            json=guest_payload_factory(email="not-an-email"),
        )

        assert response.status_code == 422
        assert db_session.query(Guest).count() == before_count

    def test_blank_name_rejected_before_db_insert(
        self,
        authorized_client: TestClient,
        db_session: Session,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        before_count = db_session.query(Guest).count()

        response = authorized_client.post("/api/guests", json=guest_payload_factory(name="   "))

        assert response.status_code == 422
        assert db_session.query(Guest).count() == before_count

    def test_missing_wedding_create_returns_400(
        self,
        authorized_client: TestClient,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        response = authorized_client.post("/api/guests", json=guest_payload_factory(wedding_id=999999))

        assert response.status_code == 400
        assert response.json()["detail"] == "Wedding not found"

    def test_missing_wedding_update_returns_400(
        self,
        authorized_client: TestClient,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        created = create_guest(authorized_client, guest_payload_factory, name="Move Wedding")

        response = authorized_client.put(f"/api/guests/{created['id']}", json={"wedding_id": 999999})

        assert response.status_code == 400
        assert response.json()["detail"] == "Wedding not found"

    def test_get_missing_guest_returns_404(self, authorized_client: TestClient) -> None:
        response = authorized_client.get("/api/guests/999999")

        assert response.status_code == 404
        assert response.json()["detail"] == "Guest not found"

    def test_update_missing_guest_returns_404(self, authorized_client: TestClient) -> None:
        response = authorized_client.put("/api/guests/999999", json={"notes": "missing"})

        assert response.status_code == 404
        assert response.json()["detail"] == "Guest not found"

    def test_delete_missing_guest_returns_404(self, authorized_client: TestClient) -> None:
        response = authorized_client.delete("/api/guests/999999")

        assert response.status_code == 404
        assert response.json()["detail"] == "Guest not found"

    def test_invalid_table_number_rejected(
        self,
        authorized_client: TestClient,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        response = authorized_client.post("/api/guests", json=guest_payload_factory(table_number=0))

        assert response.status_code == 422

    def test_plus_one_fields_persist(
        self,
        authorized_client: TestClient,
        db_session: Session,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        created = create_guest(
            authorized_client,
            guest_payload_factory,
            plus_one_name="Guest Plus One",
            plus_one_rsvp="accepted",
            plus_one_dietary="Gluten-free",
        )

        persisted = fetch_guest(db_session, int(created["id"]))
        assert persisted is not None
        assert persisted.plus_one_name == "Guest Plus One"
        assert getattr(persisted.plus_one_rsvp, "value", persisted.plus_one_rsvp) == "accepted"
        assert persisted.plus_one_dietary == "Gluten-free"

    def test_rsvp_detail_fields_persist(
        self,
        authorized_client: TestClient,
        db_session: Session,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        created = create_guest(
            authorized_client,
            guest_payload_factory,
            name="RSVP Details",
            meal_choice="vegetarian",
            dietary_notes="No nuts",
        )

        assert created["meal_choice"] == "vegetarian"
        assert created["dietary_notes"] == "No nuts"

        update_response = authorized_client.put(
            f"/api/guests/{created['id']}",
            json={"meal_choice": "fish", "dietary_notes": "Dairy-free"},
        )

        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["meal_choice"] == "fish"
        assert updated["dietary_notes"] == "Dairy-free"

        persisted = fetch_guest(db_session, int(created["id"]))
        assert persisted is not None
        assert persisted.meal_choice == "fish"
        assert persisted.dietary_notes == "Dairy-free"

    def test_concurrent_guest_creation(
        self,
        db_session: Session,
        guest_payload_factory: Callable[..., dict[str, object]],
    ) -> None:
        invite_code = f"PYTEST-FIXTURE-CONC-{uuid4().hex[:8].upper()}"
        invite = Invite(
            code=invite_code,
            wedding_id=1,
            household_name="Concurrent Coordinator",
            role="coordinator",
        )
        db_session.add(invite)
        db_session.commit()
        payloads = [
            guest_payload_factory(name=f"Concurrent Guest {index}")
            for index in range(5)
        ]

        def post_guest(payload: dict[str, object]) -> int:
            with TestClient(app) as thread_client:
                login_response = thread_client.post(
                    "/api/auth/login",
                    json={"invite_code": invite_code},
                )
                if login_response.status_code != 200:
                    return login_response.status_code
                return thread_client.post("/api/guests", json=payload).status_code

        try:
            with ThreadPoolExecutor(max_workers=5) as executor:
                statuses = list(executor.map(post_guest, payloads))

            assert statuses == [201, 201, 201, 201, 201]
        finally:
            db_session.query(Invite).filter(Invite.code == invite_code).delete(
                synchronize_session=False
            )
            db_session.commit()

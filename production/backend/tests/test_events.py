from __future__ import annotations

from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Event
from tests.fixtures.guests import TEST_WEDDING_ID


def event_body(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "wedding_id": TEST_WEDDING_ID,
        "event_name": f"Pytest Event {uuid4().hex[:8]}",
        "event_date": "2026-06-19",
        "event_time": "18:00:00",
        "location": "Rehearsal Hall",
        "description": "Pytest event",
    }
    body.update(overrides)
    return body


@pytest.fixture()
def cleanup_events(db_session: Session) -> Iterator[None]:
    yield
    db_session.query(Event).filter(Event.event_name.like("Pytest Event %")).delete(
        synchronize_session=False
    )
    db_session.commit()


class TestEventIntegration:
    def test_full_event_lifecycle(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_events: None,
    ) -> None:
        created = coordinator_session.post("/api/events", json=event_body())
        assert created.status_code == 201
        data = created.json()
        event_id = int(data["id"])
        assert data["wedding_id"] == TEST_WEDDING_ID
        assert data["location"] == "Rehearsal Hall"

        listed = coordinator_session.get("/api/events")
        assert listed.status_code == 200
        assert event_id in {e["id"] for e in listed.json()}

        updated = coordinator_session.put(
            f"/api/events/{event_id}",
            json={"location": "Garden", "description": "Moved outside"},
        )
        assert updated.status_code == 200
        assert updated.json()["location"] == "Garden"

        db_session.expire_all()
        persisted = db_session.get(Event, event_id)
        assert persisted is not None
        assert persisted.location == "Garden"
        assert persisted.description == "Moved outside"

        deleted = coordinator_session.delete(f"/api/events/{event_id}")
        assert deleted.status_code == 200
        db_session.expire_all()
        assert db_session.get(Event, event_id) is None

    def test_create_other_wedding_rejected(
        self,
        coordinator_session: TestClient,
        cleanup_events: None,
    ) -> None:
        response = coordinator_session.post(
            "/api/events", json=event_body(wedding_id=999999)
        )
        assert response.status_code == 403

    def test_update_missing_returns_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.put("/api/events/999999", json={"location": "x"})
        assert response.status_code == 404

    def test_delete_missing_returns_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.delete("/api/events/999999")
        assert response.status_code == 404

    def test_blank_event_name_rejected(
        self,
        coordinator_session: TestClient,
        cleanup_events: None,
    ) -> None:
        response = coordinator_session.post(
            "/api/events", json=event_body(event_name="   ")
        )
        assert response.status_code == 422

    def test_requires_authentication(self, client: TestClient) -> None:
        assert client.get("/api/events").status_code == 401
        assert client.post("/api/events", json=event_body()).status_code == 401

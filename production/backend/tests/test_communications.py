from __future__ import annotations

from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Communication
from tests.fixtures.guests import TEST_WEDDING_ID


def communication_body(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "subject": f"Pytest Communication {uuid4().hex[:8]}",
        "body": "Hello guests, here is an update.",
        "channel": "email",
        "audience": "all",
        "status": "draft",
    }
    body.update(overrides)
    return body


@pytest.fixture()
def cleanup_communications(db_session: Session) -> Iterator[None]:
    yield
    db_session.query(Communication).filter(
        Communication.subject.like("Pytest Communication %")
    ).delete(synchronize_session=False)
    db_session.commit()


class TestCommunicationIntegration:
    def test_full_communication_lifecycle(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_communications: None,
    ) -> None:
        # wedding_id intentionally omitted from the body; handler defaults it.
        created = coordinator_session.post(
            "/api/communications", json=communication_body()
        )
        assert created.status_code == 201
        data = created.json()
        communication_id = int(data["id"])
        assert data["wedding_id"] == TEST_WEDDING_ID
        assert data["status"] == "draft"
        assert data["sent_at"] is None

        listed = coordinator_session.get("/api/communications")
        assert listed.status_code == 200
        assert communication_id in {c["id"] for c in listed.json()}

        updated = coordinator_session.put(
            f"/api/communications/{communication_id}",
            json={"subject": "Updated Subject", "audience": "attending"},
        )
        assert updated.status_code == 200
        assert updated.json()["subject"] == "Updated Subject"
        assert updated.json()["audience"] == "attending"

        sent = coordinator_session.post(
            f"/api/communications/{communication_id}/send"
        )
        assert sent.status_code == 200
        sent_data = sent.json()
        assert sent_data["status"] == "sent"
        assert sent_data["sent_at"] is not None

        db_session.expire_all()
        persisted = db_session.get(Communication, communication_id)
        assert persisted is not None
        assert persisted.status == "sent"
        assert persisted.sent_at is not None

        deleted = coordinator_session.delete(
            f"/api/communications/{communication_id}"
        )
        assert deleted.status_code == 200
        db_session.expire_all()
        assert db_session.get(Communication, communication_id) is None

    def test_create_other_wedding_rejected(
        self,
        coordinator_session: TestClient,
        cleanup_communications: None,
    ) -> None:
        response = coordinator_session.post(
            "/api/communications", json=communication_body(wedding_id=999999)
        )
        assert response.status_code == 403

    def test_invalid_channel_rejected(
        self,
        coordinator_session: TestClient,
    ) -> None:
        response = coordinator_session.post(
            "/api/communications", json=communication_body(channel="carrier-pigeon")
        )
        assert response.status_code == 422

    def test_invalid_status_rejected(
        self,
        coordinator_session: TestClient,
    ) -> None:
        response = coordinator_session.post(
            "/api/communications", json=communication_body(status="bogus")
        )
        assert response.status_code == 422

    def test_update_missing_returns_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.put(
            "/api/communications/999999", json={"subject": "x"}
        )
        assert response.status_code == 404

    def test_delete_missing_returns_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.delete("/api/communications/999999")
        assert response.status_code == 404

    def test_send_missing_returns_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.post("/api/communications/999999/send")
        assert response.status_code == 404

    def test_requires_authentication(self, client: TestClient) -> None:
        assert client.get("/api/communications").status_code == 401
        assert (
            client.post("/api/communications", json=communication_body()).status_code
            == 401
        )
        assert client.post("/api/communications/1/send").status_code == 401

from __future__ import annotations

from collections.abc import Callable, Iterator
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Feedback, Wedding
from tests.fixtures.guests import TEST_WEDDING_ID


@pytest.fixture()
def set_wedding_phase(db_session: Session) -> Iterator[Callable[[str], None]]:
    """Snapshot the shared seed wedding's phase and restore it after the test."""
    wedding = db_session.get(Wedding, TEST_WEDDING_ID)
    assert wedding is not None
    original = wedding.phase

    def _set(phase: str) -> None:
        db_session.expire_all()
        target = db_session.get(Wedding, TEST_WEDDING_ID)
        assert target is not None
        target.phase = phase
        db_session.commit()

    try:
        yield _set
    finally:
        db_session.expire_all()
        target = db_session.get(Wedding, TEST_WEDDING_ID)
        if target is not None:
            target.phase = original
            db_session.commit()


@pytest.fixture()
def cleanup_feedback(db_session: Session) -> Iterator[None]:
    yield
    db_session.query(Feedback).filter(
        Feedback.submitted_by.like("Pytest%"),
    ).delete(synchronize_session=False)
    db_session.commit()


def make_feedback(**overrides: object) -> Feedback:
    values: dict[str, object] = {
        "wedding_id": TEST_WEDDING_ID,
        "submitted_by": "Pytest Seeder",
        "type": "bug",
        "message": "Pytest seeded feedback",
    }
    values.update(overrides)
    return Feedback(**values)


class TestSubmitFeedback:
    def test_guest_can_submit_with_context(
        self,
        guest_session: TestClient,
        cleanup_feedback: None,
    ) -> None:
        response = guest_session.post(
            "/api/feedback",
            json={
                "type": "bug",
                "message": "  The gallery photos overlap on my phone.  ",
                "page": "/gallery",
                "role": "guest",
                "viewport": "390x844",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["wedding_id"] == TEST_WEDDING_ID
        assert data["type"] == "bug"
        assert data["message"] == "The gallery photos overlap on my phone."
        assert data["page"] == "/gallery"
        assert data["role"] == "guest"
        assert data["viewport"] == "390x844"
        assert data["status"] == "new"
        # submitted_by comes from the session, not the request body.
        assert data["submitted_by"] == "Pytest Guest"

    def test_guest_submit_is_not_phase_gated(
        self,
        guest_session: TestClient,
        set_wedding_phase: Callable[[str], None],
        cleanup_feedback: None,
    ) -> None:
        # Unlike song requests, feedback is welcome in every phase.
        set_wedding_phase("planning")
        response = guest_session.post(
            "/api/feedback",
            json={"type": "idea", "message": "A countdown on the dashboard!"},
        )
        assert response.status_code == 201
        assert response.json()["status"] == "new"

    def test_missing_message_rejected(self, guest_session: TestClient) -> None:
        response = guest_session.post("/api/feedback", json={"type": "bug"})
        assert response.status_code == 422

    def test_blank_message_rejected(self, guest_session: TestClient) -> None:
        response = guest_session.post(
            "/api/feedback", json={"type": "bug", "message": "   "}
        )
        assert response.status_code == 422

    def test_overlong_message_rejected(self, guest_session: TestClient) -> None:
        response = guest_session.post(
            "/api/feedback", json={"type": "bug", "message": "x" * 2001}
        )
        assert response.status_code == 422

    def test_invalid_type_rejected(self, guest_session: TestClient) -> None:
        response = guest_session.post(
            "/api/feedback", json={"type": "rant", "message": "Nope."}
        )
        assert response.status_code == 422


class TestListFeedback:
    def test_guest_cannot_list(self, guest_session: TestClient) -> None:
        assert guest_session.get("/api/feedback").status_code == 403

    def test_coordinator_list_returns_all_newest_first(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_feedback: None,
    ) -> None:
        older = make_feedback(message="Pytest older report")
        db_session.add(older)
        db_session.commit()
        newer = make_feedback(message="Pytest newer report", type="idea")
        db_session.add(newer)
        db_session.commit()

        response = coordinator_session.get("/api/feedback")
        assert response.status_code == 200
        ids = [item["id"] for item in response.json()]
        assert older.id in ids
        assert newer.id in ids
        assert ids.index(newer.id) < ids.index(older.id)

    def test_coordinator_list_filters_by_status(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_feedback: None,
    ) -> None:
        fresh = make_feedback(message="Pytest fresh")
        triaged = make_feedback(message="Pytest triaged", status="triaged")
        done = make_feedback(message="Pytest done", status="done")
        db_session.add_all([fresh, triaged, done])
        db_session.commit()

        response = coordinator_session.get("/api/feedback?status=triaged")
        assert response.status_code == 200
        ids = [item["id"] for item in response.json()]
        assert triaged.id in ids
        assert fresh.id not in ids
        assert done.id not in ids

    def test_invalid_status_filter_rejected(
        self, coordinator_session: TestClient
    ) -> None:
        assert coordinator_session.get("/api/feedback?status=bogus").status_code == 422


class TestTriageFeedback:
    def test_guest_cannot_patch(
        self,
        guest_session: TestClient,
        db_session: Session,
        cleanup_feedback: None,
    ) -> None:
        feedback = make_feedback(message="Pytest guarded")
        db_session.add(feedback)
        db_session.commit()
        response = guest_session.patch(
            f"/api/feedback/{feedback.id}", json={"status": "triaged"}
        )
        assert response.status_code == 403

    def test_coordinator_can_triage_then_finish(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_feedback: None,
    ) -> None:
        feedback = make_feedback(message="Pytest triage flow")
        db_session.add(feedback)
        db_session.commit()

        triaged = coordinator_session.patch(
            f"/api/feedback/{feedback.id}", json={"status": "triaged"}
        )
        assert triaged.status_code == 200
        assert triaged.json()["status"] == "triaged"

        done = coordinator_session.patch(
            f"/api/feedback/{feedback.id}", json={"status": "done"}
        )
        assert done.status_code == 200
        assert done.json()["status"] == "done"

        db_session.expire_all()
        persisted = db_session.get(Feedback, feedback.id)
        assert persisted is not None
        assert persisted.status == "done"

    def test_patch_invalid_status_rejected(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_feedback: None,
    ) -> None:
        feedback = make_feedback(message="Pytest invalid status")
        db_session.add(feedback)
        db_session.commit()
        response = coordinator_session.patch(
            f"/api/feedback/{feedback.id}", json={"status": "archived"}
        )
        assert response.status_code == 422

    def test_patch_unknown_returns_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.patch(
            "/api/feedback/999999", json={"status": "triaged"}
        )
        assert response.status_code == 404


class TestCrossWedding:
    @pytest.fixture()
    def other_wedding_feedback(self, db_session: Session) -> Iterator[Feedback]:
        """Feedback belonging to a different wedding than the session's."""
        other_wedding = Wedding(
            couple_names="Pytest Other Couple",
            wedding_date=date(2030, 1, 1),
        )
        db_session.add(other_wedding)
        db_session.commit()
        feedback = make_feedback(
            wedding_id=other_wedding.id, message="Pytest cross-wedding"
        )
        db_session.add(feedback)
        db_session.commit()
        try:
            yield feedback
        finally:
            db_session.delete(feedback)
            db_session.delete(other_wedding)
            db_session.commit()

    def test_patch_other_weddings_feedback_is_404(
        self,
        coordinator_session: TestClient,
        other_wedding_feedback: Feedback,
    ) -> None:
        response = coordinator_session.patch(
            f"/api/feedback/{other_wedding_feedback.id}", json={"status": "triaged"}
        )
        assert response.status_code == 404

    def test_list_excludes_other_weddings_feedback(
        self,
        coordinator_session: TestClient,
        other_wedding_feedback: Feedback,
    ) -> None:
        response = coordinator_session.get("/api/feedback")
        assert response.status_code == 200
        ids = [item["id"] for item in response.json()]
        assert other_wedding_feedback.id not in ids


class TestUnauthenticated:
    def test_all_endpoints_require_authentication(self, client: TestClient) -> None:
        assert (
            client.post(
                "/api/feedback", json={"type": "bug", "message": "x"}
            ).status_code
            == 401
        )
        assert client.get("/api/feedback").status_code == 401
        assert (
            client.patch("/api/feedback/1", json={"status": "done"}).status_code == 401
        )

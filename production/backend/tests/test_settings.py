from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Wedding
from tests.fixtures.guests import TEST_WEDDING_ID


@pytest.fixture()
def restore_wedding(db_session: Session) -> Iterator[None]:
    """Snapshot the shared seed wedding and restore it after the test so other
    tests are unaffected by mutations made through the settings API."""
    wedding = db_session.get(Wedding, TEST_WEDDING_ID)
    assert wedding is not None
    original = {
        "couple_names": wedding.couple_names,
        "wedding_date": wedding.wedding_date,
        "ceremony_time": wedding.ceremony_time,
        "ceremony_location": wedding.ceremony_location,
        "reception_location": wedding.reception_location,
    }
    try:
        yield
    finally:
        db_session.expire_all()
        wedding = db_session.get(Wedding, TEST_WEDDING_ID)
        if wedding is not None:
            for field, value in original.items():
                setattr(wedding, field, value)
            db_session.commit()


class TestWeddingSettings:
    def test_get_returns_seeded_wedding(
        self,
        coordinator_session: TestClient,
        db_session: Session,
    ) -> None:
        response = coordinator_session.get("/api/settings/wedding")
        assert response.status_code == 200
        data = response.json()

        wedding = db_session.get(Wedding, TEST_WEDDING_ID)
        assert wedding is not None
        assert data["id"] == TEST_WEDDING_ID
        assert data["couple_names"] == wedding.couple_names
        assert data["wedding_date"] == wedding.wedding_date.isoformat()
        # Response shape only exposes editable settings fields.
        assert set(data.keys()) == {
            "id",
            "couple_names",
            "wedding_date",
            "ceremony_time",
            "ceremony_location",
            "reception_location",
            "phase",
        }

    def test_put_updates_and_persists(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        restore_wedding: None,
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"ceremony_location": "The Pytest Chapel"},
        )
        assert response.status_code == 200
        assert response.json()["ceremony_location"] == "The Pytest Chapel"
        # The update only ever targets the current user's wedding.
        assert response.json()["id"] == TEST_WEDDING_ID

        db_session.expire_all()
        persisted = db_session.get(Wedding, TEST_WEDDING_ID)
        assert persisted is not None
        assert persisted.ceremony_location == "The Pytest Chapel"

    def test_put_partial_update_leaves_other_fields(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        restore_wedding: None,
    ) -> None:
        before = coordinator_session.get("/api/settings/wedding").json()

        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"reception_location": "Pytest Reception Hall"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["reception_location"] == "Pytest Reception Hall"
        # Untouched fields are unchanged by the partial update.
        assert data["couple_names"] == before["couple_names"]
        assert data["wedding_date"] == before["wedding_date"]

    def test_put_blank_couple_names_rejected(
        self,
        coordinator_session: TestClient,
    ) -> None:
        response = coordinator_session.put(
            "/api/settings/wedding",
            json={"couple_names": "   "},
        )
        assert response.status_code == 422

    def test_get_requires_authentication(self, client: TestClient) -> None:
        assert client.get("/api/settings/wedding").status_code == 401

    def test_put_requires_authentication(self, client: TestClient) -> None:
        response = client.put(
            "/api/settings/wedding",
            json={"couple_names": "Hackers"},
        )
        assert response.status_code == 401

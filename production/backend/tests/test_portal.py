from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Event, Wedding
from tests.fixtures.guests import TEST_WEDDING_ID


TEST_EVENT_PREFIX = "PYTEST-EVENT-"


def delete_test_events(db_session: Session) -> None:
    db_session.query(Event).filter(
        Event.event_name.like(f"{TEST_EVENT_PREFIX}%")
    ).delete(synchronize_session=False)
    db_session.commit()


@pytest.fixture()
def clean_test_events(db_session: Session) -> Iterator[None]:
    delete_test_events(db_session)
    yield
    delete_test_events(db_session)


class TestPortalWedding:
    def test_guest_can_read_wedding(
        self,
        guest_session: TestClient,
        db_session: Session,
    ) -> None:
        response = guest_session.get("/api/portal/wedding")
        assert response.status_code == 200
        data = response.json()

        wedding = db_session.get(Wedding, TEST_WEDDING_ID)
        assert wedding is not None
        assert data["couple_names"] == wedding.couple_names
        assert data["wedding_date"] == wedding.wedding_date.isoformat()
        assert set(data.keys()) == {
            "couple_names",
            "wedding_date",
            "ceremony_time",
            "ceremony_location",
            "reception_location",
            "phase",
        }

    def test_wedding_requires_authentication(self, client: TestClient) -> None:
        assert client.get("/api/portal/wedding").status_code == 401


class TestPortalSchedule:
    def test_guest_can_read_schedule_ordered(
        self,
        guest_session: TestClient,
        db_session: Session,
        clean_test_events: None,
    ) -> None:
        from datetime import date, time

        later = Event(
            wedding_id=TEST_WEDDING_ID,
            event_name=f"{TEST_EVENT_PREFIX}Reception",
            event_date=date(2030, 6, 2),
            event_time=time(18, 0),
            location="Hall",
            description="Dinner and dancing",
        )
        earlier = Event(
            wedding_id=TEST_WEDDING_ID,
            event_name=f"{TEST_EVENT_PREFIX}Ceremony",
            event_date=date(2030, 6, 1),
            event_time=time(14, 0),
            location="Chapel",
            description=None,
        )
        db_session.add_all([later, earlier])
        db_session.commit()

        response = guest_session.get("/api/portal/schedule")
        assert response.status_code == 200
        rows = response.json()

        test_rows = [r for r in rows if r["event_name"].startswith(TEST_EVENT_PREFIX)]
        assert [r["event_name"] for r in test_rows] == [
            f"{TEST_EVENT_PREFIX}Ceremony",
            f"{TEST_EVENT_PREFIX}Reception",
        ]
        assert set(test_rows[0].keys()) == {
            "id",
            "event_name",
            "event_date",
            "event_time",
            "location",
            "description",
        }

    def test_schedule_requires_authentication(self, client: TestClient) -> None:
        assert client.get("/api/portal/schedule").status_code == 401

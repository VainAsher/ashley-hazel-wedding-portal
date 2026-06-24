from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Blessing
from tests.fixtures.guests import TEST_WEDDING_ID


TEST_AUTHOR_PREFIX = "PYTEST-BLESSING-"


def delete_test_blessings(db_session: Session) -> None:
    db_session.query(Blessing).filter(
        Blessing.author_name.like(f"{TEST_AUTHOR_PREFIX}%")
    ).delete(synchronize_session=False)
    db_session.commit()


@pytest.fixture()
def clean_test_blessings(db_session: Session) -> Iterator[None]:
    delete_test_blessings(db_session)
    yield
    delete_test_blessings(db_session)


class TestBlessings:
    def test_guest_can_create_blessing(
        self,
        guest_session: TestClient,
        db_session: Session,
        clean_test_blessings: None,
    ) -> None:
        response = guest_session.post(
            "/api/blessings",
            json={
                "author_name": f"{TEST_AUTHOR_PREFIX}Author",
                "message": "Wishing you a lifetime of happiness!",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["author_name"] == f"{TEST_AUTHOR_PREFIX}Author"
        assert data["message"] == "Wishing you a lifetime of happiness!"
        assert set(data.keys()) == {"id", "author_name", "message", "created_at"}

        persisted = db_session.get(Blessing, data["id"])
        assert persisted is not None
        assert persisted.wedding_id == TEST_WEDDING_ID
        assert persisted.hidden is False

    def test_author_defaults_to_guest_name(
        self,
        guest_session: TestClient,
        db_session: Session,
        clean_test_blessings: None,
    ) -> None:
        # No author_name provided -> falls back to the authenticated guest name.
        me = guest_session.get("/api/auth/me").json()
        response = guest_session.post(
            "/api/blessings",
            json={"message": "So happy for you both!"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["author_name"] == me["name"]

        # Clean up this row (author won't match the prefix).
        db_session.query(Blessing).filter(Blessing.id == data["id"]).delete(
            synchronize_session=False
        )
        db_session.commit()

    def test_blank_author_defaults_to_guest_name(
        self,
        guest_session: TestClient,
        db_session: Session,
    ) -> None:
        me = guest_session.get("/api/auth/me").json()
        response = guest_session.post(
            "/api/blessings",
            json={"author_name": "   ", "message": "Congratulations!"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["author_name"] == me["name"]

        db_session.query(Blessing).filter(Blessing.id == data["id"]).delete(
            synchronize_session=False
        )
        db_session.commit()

    def test_blank_message_rejected(
        self,
        guest_session: TestClient,
    ) -> None:
        response = guest_session.post(
            "/api/blessings",
            json={"author_name": f"{TEST_AUTHOR_PREFIX}Author", "message": "   "},
        )
        assert response.status_code == 422

    def test_list_excludes_hidden_and_orders_newest_first(
        self,
        guest_session: TestClient,
        db_session: Session,
        clean_test_blessings: None,
    ) -> None:
        visible_old = Blessing(
            wedding_id=TEST_WEDDING_ID,
            author_name=f"{TEST_AUTHOR_PREFIX}Old",
            message="An older blessing",
            hidden=False,
        )
        visible_new = Blessing(
            wedding_id=TEST_WEDDING_ID,
            author_name=f"{TEST_AUTHOR_PREFIX}New",
            message="A newer blessing",
            hidden=False,
        )
        hidden = Blessing(
            wedding_id=TEST_WEDDING_ID,
            author_name=f"{TEST_AUTHOR_PREFIX}Hidden",
            message="A hidden blessing",
            hidden=True,
        )
        db_session.add_all([visible_old, visible_new, hidden])
        db_session.commit()

        response = guest_session.get("/api/blessings")
        assert response.status_code == 200
        rows = response.json()

        authors = [row["author_name"] for row in rows]
        assert f"{TEST_AUTHOR_PREFIX}Hidden" not in authors
        assert f"{TEST_AUTHOR_PREFIX}Old" in authors
        assert f"{TEST_AUTHOR_PREFIX}New" in authors

        # Newest first: among our test rows, "New" was inserted after "Old".
        test_rows = [r for r in rows if r["author_name"].startswith(TEST_AUTHOR_PREFIX)]
        assert test_rows[0]["author_name"] == f"{TEST_AUTHOR_PREFIX}New"

    def test_list_requires_authentication(self, client: TestClient) -> None:
        assert client.get("/api/blessings").status_code == 401

    def test_create_requires_authentication(self, client: TestClient) -> None:
        response = client.post(
            "/api/blessings",
            json={"author_name": "Hacker", "message": "Hi"},
        )
        assert response.status_code == 401

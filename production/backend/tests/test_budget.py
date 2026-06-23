from __future__ import annotations

from collections.abc import Iterator
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import BudgetItem
from tests.fixtures.guests import TEST_WEDDING_ID


CATEGORY_CATERING = 2  # seeded "Catering" budget category
DESC_PREFIX = "Pytest budget"


def budget_body(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "wedding_id": TEST_WEDDING_ID,
        "vendor_id": None,
        "category_id": CATEGORY_CATERING,
        "description": f"{DESC_PREFIX} {uuid4().hex[:8]}",
        "estimated_cost": "2500.00",
        "actual_cost": "0.00",
        "paid": False,
        "notes": "Pytest budget item",
    }
    body.update(overrides)
    return body


@pytest.fixture()
def cleanup_budget_items(db_session: Session) -> Iterator[None]:
    yield
    db_session.query(BudgetItem).filter(
        BudgetItem.description.like(f"{DESC_PREFIX} %")
    ).delete(synchronize_session=False)
    db_session.commit()


class TestBudgetIntegration:
    def test_list_categories(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.get("/api/budget/categories")
        assert response.status_code == 200
        categories = response.json()
        assert len(categories) == 12
        names = {c["category_name"] for c in categories}
        assert "Catering" in names

    def test_full_budget_item_lifecycle(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_budget_items: None,
    ) -> None:
        created = coordinator_session.post("/api/budget/items", json=budget_body())
        assert created.status_code == 201
        data = created.json()
        item_id = int(data["id"])
        assert data["category_name"] == "Catering"
        assert data["vendor_name"] is None
        assert data["wedding_id"] == TEST_WEDDING_ID

        listed = coordinator_session.get("/api/budget/items")
        assert listed.status_code == 200
        assert item_id in {i["id"] for i in listed.json()}

        updated = coordinator_session.put(
            f"/api/budget/items/{item_id}",
            json={"actual_cost": "2400.00", "paid": True},
        )
        assert updated.status_code == 200
        assert updated.json()["paid"] is True

        db_session.expire_all()
        persisted = db_session.get(BudgetItem, item_id)
        assert persisted is not None
        assert persisted.paid is True
        assert persisted.actual_cost == Decimal("2400.00")

        deleted = coordinator_session.delete(f"/api/budget/items/{item_id}")
        assert deleted.status_code == 200
        db_session.expire_all()
        assert db_session.get(BudgetItem, item_id) is None

    def test_summary_aggregates(
        self,
        coordinator_session: TestClient,
        cleanup_budget_items: None,
    ) -> None:
        coordinator_session.post(
            "/api/budget/items",
            json=budget_body(estimated_cost="1000.00", actual_cost="900.00", paid=True),
        )
        coordinator_session.post(
            "/api/budget/items",
            json=budget_body(estimated_cost="500.00", actual_cost="0.00", paid=False),
        )

        response = coordinator_session.get("/api/budget/summary")
        assert response.status_code == 200
        summary = response.json()

        # Other rows may exist in the shared wedding; assert our contribution is reflected.
        assert Decimal(summary["total_estimated"]) >= Decimal("1500.00")
        assert Decimal(summary["total_paid"]) >= Decimal("900.00")
        expected_remaining = Decimal(summary["total_estimated"]) - Decimal(
            summary["total_paid"]
        )
        assert Decimal(summary["remaining"]) == expected_remaining

        catering = next(
            (c for c in summary["by_category"] if c["category_id"] == CATEGORY_CATERING),
            None,
        )
        assert catering is not None
        assert catering["category_name"] == "Catering"

    def test_create_other_wedding_rejected(
        self,
        coordinator_session: TestClient,
        cleanup_budget_items: None,
    ) -> None:
        response = coordinator_session.post(
            "/api/budget/items", json=budget_body(wedding_id=999999)
        )
        assert response.status_code == 403

    def test_invalid_category_rejected(
        self,
        coordinator_session: TestClient,
        cleanup_budget_items: None,
    ) -> None:
        response = coordinator_session.post(
            "/api/budget/items", json=budget_body(category_id=999999)
        )
        assert response.status_code == 400

    def test_update_missing_returns_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.put(
            "/api/budget/items/999999", json={"paid": True}
        )
        assert response.status_code == 404

    def test_delete_missing_returns_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.delete("/api/budget/items/999999")
        assert response.status_code == 404

    def test_requires_authentication(self, client: TestClient) -> None:
        assert client.get("/api/budget/categories").status_code == 401
        assert client.get("/api/budget/items").status_code == 401
        assert client.get("/api/budget/summary").status_code == 401
        assert client.post("/api/budget/items", json=budget_body()).status_code == 401

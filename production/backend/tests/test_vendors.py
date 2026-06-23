from __future__ import annotations

from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Vendor
from tests.fixtures.guests import TEST_WEDDING_ID


CATEGORY_CATERING = 2  # seeded "Catering" budget category


def vendor_body(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "wedding_id": TEST_WEDDING_ID,
        "vendor_name": f"Pytest Vendor {uuid4().hex[:8]}",
        "category_id": CATEGORY_CATERING,
        "contact_person": "Vendor Contact",
        "email": f"vendor-{uuid4().hex[:8]}@example.com",
        "phone": "555-0120",
        "website": "https://example.com",
        "contract_signed": False,
        "notes": "Pytest vendor",
    }
    body.update(overrides)
    return body


@pytest.fixture()
def cleanup_vendors(db_session: Session) -> Iterator[None]:
    yield
    db_session.query(Vendor).filter(Vendor.vendor_name.like("Pytest Vendor %")).delete(
        synchronize_session=False
    )
    db_session.commit()


class TestVendorIntegration:
    def test_full_vendor_lifecycle(
        self,
        coordinator_session: TestClient,
        db_session: Session,
        cleanup_vendors: None,
    ) -> None:
        created = coordinator_session.post("/api/vendors", json=vendor_body())
        assert created.status_code == 201
        data = created.json()
        vendor_id = int(data["id"])
        assert data["category_name"] == "Catering"
        assert data["wedding_id"] == TEST_WEDDING_ID

        listed = coordinator_session.get("/api/vendors")
        assert listed.status_code == 200
        assert vendor_id in {v["id"] for v in listed.json()}

        updated = coordinator_session.put(
            f"/api/vendors/{vendor_id}",
            json={"contract_signed": True, "notes": "Signed"},
        )
        assert updated.status_code == 200
        assert updated.json()["contract_signed"] is True

        db_session.expire_all()
        persisted = db_session.get(Vendor, vendor_id)
        assert persisted is not None
        assert persisted.contract_signed is True
        assert persisted.notes == "Signed"

        deleted = coordinator_session.delete(f"/api/vendors/{vendor_id}")
        assert deleted.status_code == 200
        db_session.expire_all()
        assert db_session.get(Vendor, vendor_id) is None

    def test_create_other_wedding_rejected(
        self,
        coordinator_session: TestClient,
        cleanup_vendors: None,
    ) -> None:
        response = coordinator_session.post(
            "/api/vendors", json=vendor_body(wedding_id=999999)
        )
        assert response.status_code == 403

    def test_update_missing_returns_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.put("/api/vendors/999999", json={"notes": "x"})
        assert response.status_code == 404

    def test_delete_missing_returns_404(self, coordinator_session: TestClient) -> None:
        response = coordinator_session.delete("/api/vendors/999999")
        assert response.status_code == 404

    def test_invalid_category_rejected(
        self,
        coordinator_session: TestClient,
        cleanup_vendors: None,
    ) -> None:
        response = coordinator_session.post(
            "/api/vendors", json=vendor_body(category_id=999999)
        )
        assert response.status_code == 400

    def test_requires_authentication(self, client: TestClient) -> None:
        assert client.get("/api/vendors").status_code == 401
        assert client.post("/api/vendors", json=vendor_body()).status_code == 401

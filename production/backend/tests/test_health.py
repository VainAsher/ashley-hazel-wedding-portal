from __future__ import annotations

from fastapi.testclient import TestClient


def test_health_liveness_does_not_require_db(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_health_ready_queries_db_and_succeeds(client: TestClient) -> None:
    # With a reachable, migrated database (as in CI), readiness must report ready.
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"

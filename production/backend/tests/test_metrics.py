from __future__ import annotations

import logging
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import settings as app_settings
from app.metrics import (
    endpoint_label,
    install_database_metrics,
    observe_db_query,
    observe_request,
    sql_operation,
    statement_summary,
)


def make_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "database_url": "postgresql://user:password@localhost:5432/wedding",
        "_env_file": None,
    }
    values.update(overrides)
    return Settings(**values)


def test_endpoint_label_uses_fastapi_route_template() -> None:
    request = SimpleNamespace(
        scope={"route": SimpleNamespace(path="/api/guests/{guest_id}")},
        url=SimpleNamespace(path="/api/guests/123"),
    )

    assert endpoint_label(request) == "/api/guests/{guest_id}"


def test_endpoint_label_falls_back_to_raw_path() -> None:
    request = SimpleNamespace(
        scope={},
        url=SimpleNamespace(path="/unmatched/path"),
    )

    assert endpoint_label(request) == "/unmatched/path"


@pytest.mark.parametrize(
    ("statement", "operation"),
    [
        ("SELECT * FROM guests", "SELECT"),
        (" insert into guests (name) values (%s)", "INSERT"),
        ("UPDATE guests SET name = %s", "UPDATE"),
        ("delete from guests where id = %s", "DELETE"),
        ("", "UNKNOWN"),
    ],
)
def test_sql_operation_extracts_common_operations(statement: str, operation: str) -> None:
    assert sql_operation(statement) == operation


def test_statement_summary_redacts_literals_and_limits_output() -> None:
    statement = (
        "SELECT * FROM guests WHERE email = 'guest@example.com' "
        "AND phone = '5551234567' AND table_number = 12345"
    )

    summary = statement_summary(statement)

    assert summary.startswith("SELECT")
    assert "guest@example.com" not in summary
    assert "5551234567" not in summary
    assert "12345" not in summary
    assert len(summary) <= 120


def test_metrics_endpoint_returns_prometheus_format(client: TestClient) -> None:
    response = client.get("/metrics")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert "# HELP http_requests_total" in response.text
    assert "# HELP http_request_duration_seconds" in response.text
    assert "# HELP http_active_requests" in response.text


def test_metrics_endpoint_returns_404_when_disabled(client: TestClient) -> None:
    original = app_settings.metrics_enabled
    app_settings.metrics_enabled = False

    try:
        response = client.get("/metrics")
    finally:
        app_settings.metrics_enabled = original

    assert response.status_code == 404


def test_request_metrics_are_recorded_with_route_label(client: TestClient) -> None:
    health_response = client.get("/health")
    metrics_response = client.get("/metrics")

    assert health_response.status_code == 200
    assert metrics_response.status_code == 200
    assert "http_requests_total" in metrics_response.text
    assert 'endpoint="/health"' in metrics_response.text
    assert 'method="GET"' in metrics_response.text
    assert 'status="200"' in metrics_response.text


def test_observe_request_logs_slow_request(caplog: pytest.LogCaptureFixture) -> None:
    settings = make_settings(slow_request_threshold_ms=1.0)

    with caplog.at_level(logging.WARNING, logger="app.metrics"):
        observe_request("GET", "/api/guests", 200, 0.002, settings)

    record = next(
        item for item in caplog.records if item.message == "slow_http_request"
    )
    assert record.method == "GET"
    assert record.endpoint == "/api/guests"
    assert record.status == "200"
    assert record.duration_ms >= 2.0
    assert record.threshold_ms == 1.0


def test_observe_db_query_logs_slow_query_without_parameters(
    caplog: pytest.LogCaptureFixture,
) -> None:
    settings = make_settings(slow_query_threshold_ms=1.0)
    statement = "SELECT * FROM guests WHERE email = 'guest@example.com'"

    with caplog.at_level(logging.WARNING, logger="app.metrics"):
        observe_db_query(statement, 0.002, "success", settings)

    record = next(item for item in caplog.records if item.message == "slow_db_query")
    assert record.operation == "SELECT"
    assert record.status == "success"
    assert record.duration_ms >= 2.0
    assert record.threshold_ms == 1.0
    assert "guest@example.com" not in record.statement_summary


def test_install_database_metrics_is_idempotent(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.metrics as metrics

    calls: list[tuple[object, str, object]] = []

    def fake_listen(target: object, identifier: str, fn: object) -> None:
        calls.append((target, identifier, fn))

    monkeypatch.setattr(metrics.event, "listen", fake_listen)
    monkeypatch.setattr(metrics, "_DB_LISTENERS_INSTALLED", False)

    install_database_metrics()
    install_database_metrics()

    assert [call[1] for call in calls] == [
        "before_cursor_execute",
        "after_cursor_execute",
        "handle_error",
    ]

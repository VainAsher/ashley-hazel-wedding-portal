from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.metrics import endpoint_label, sql_operation, statement_summary


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

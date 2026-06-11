from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.db.database import engine
from app.db.models import GuestAudit


MIGRATION_PATH = (
    Path(__file__).parents[2] / "database" / "migrations" / "004_create_audit_triggers.sql"
)

EXPECTED_AUDIT_INDEXES = {
    "idx_guest_audit_guest_id",
    "idx_guest_audit_changed_at",
    "idx_guest_audit_guest_changed_at",
}


def migration_sql_without_outer_transaction() -> str:
    lines = []
    for line in MIGRATION_PATH.read_text().splitlines():
        stripped = line.strip().upper()
        if stripped in {"BEGIN;", "COMMIT;"}:
            continue
        lines.append(line)
    return "\n".join(lines)


@pytest.fixture()
def audit_connection() -> Iterator[Connection]:
    connection = engine.connect()
    transaction = connection.begin()
    try:
        migration_sql = migration_sql_without_outer_transaction()
        connection.exec_driver_sql(migration_sql)
        connection.exec_driver_sql(migration_sql)
        yield connection
    finally:
        transaction.rollback()
        connection.close()


def unique_email(label: str) -> str:
    return f"pytest-audit-{label}-{uuid4().hex}@example.com"


def create_guest(connection: Connection) -> int:
    guest_id = connection.execute(
        text(
            """
            INSERT INTO guests (
              wedding_id,
              name,
              email,
              phone,
              relationship,
              rsvp_status
            )
            VALUES (
              1,
              'Audit Test Guest',
              :email,
              '555-0100',
              'test',
              'pending'
            )
            RETURNING id
            """
        ),
        {"email": unique_email("guest")},
    ).scalar_one()
    return int(guest_id)


def audit_entries(connection: Connection, guest_id: int) -> list[dict[str, object]]:
    return list(
        connection.execute(
            text(
                """
                SELECT action, old_values, new_values, changed_by
                FROM guest_audit
                WHERE guest_id = :guest_id
                ORDER BY id
                """
            ),
            {"guest_id": guest_id},
        )
        .mappings()
        .all()
    )


def test_guest_audit_model_matches_migration() -> None:
    index_names = {index.name for index in GuestAudit.__table__.indexes}
    constraint_names = {
        constraint.name for constraint in GuestAudit.__table__.constraints if constraint.name
    }

    assert EXPECTED_AUDIT_INDEXES.issubset(index_names)
    assert "ck_guest_audit_action" in constraint_names
    assert GuestAudit.__table__.c.guest_id.nullable is False
    assert GuestAudit.__table__.c.action.nullable is False
    assert GuestAudit.__table__.c.changed_at.nullable is False


def test_audit_migration_is_idempotent() -> None:
    sql = MIGRATION_PATH.read_text()

    assert "CREATE TABLE IF NOT EXISTS guest_audit" in sql
    assert "CREATE OR REPLACE FUNCTION log_guest_changes()" in sql
    assert "DROP TRIGGER IF EXISTS trg_guests_audit ON guests" in sql
    assert "CREATE TRIGGER trg_guests_audit" in sql
    for index_name in EXPECTED_AUDIT_INDEXES:
        assert f"CREATE INDEX IF NOT EXISTS {index_name}" in sql


def test_guest_insert_update_delete_are_logged(audit_connection: Connection) -> None:
    guest_id = create_guest(audit_connection)

    audit_connection.execute(
        text(
            """
            UPDATE guests
            SET rsvp_status = 'accepted',
                notes = 'Updated by audit test'
            WHERE id = :guest_id
            """
        ),
        {"guest_id": guest_id},
    )
    audit_connection.execute(
        text("DELETE FROM guests WHERE id = :guest_id"),
        {"guest_id": guest_id},
    )

    entries = audit_entries(audit_connection, guest_id)

    assert [entry["action"] for entry in entries] == ["INSERT", "UPDATE", "DELETE"]
    assert entries[0]["old_values"] is None
    assert entries[0]["new_values"]["id"] == guest_id
    assert entries[1]["old_values"]["rsvp_status"] == "pending"
    assert entries[1]["new_values"]["rsvp_status"] == "accepted"
    assert entries[2]["old_values"]["id"] == guest_id
    assert entries[2]["new_values"] is None
    assert all(entry["changed_by"] for entry in entries)


def test_guest_audit_history_query(audit_connection: Connection) -> None:
    guest_id = create_guest(audit_connection)

    rows = audit_entries(audit_connection, guest_id)

    assert len(rows) == 1
    assert rows[0]["action"] == "INSERT"
    assert rows[0]["new_values"]["email"].startswith("pytest-audit-guest-")

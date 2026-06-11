from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DataError, IntegrityError

from app.api.guests import guest_constraint_message
from app.db.database import engine
from app.db.models import Guest


MIGRATION_PATH = (
    Path(__file__).parents[2] / "database" / "migrations" / "003_add_constraints.sql"
)

EXPECTED_GUEST_CONSTRAINTS = {
    "uq_guests_wedding_email",
    "ck_guests_name_not_blank",
    "ck_guests_email_format",
    "ck_guests_rsvp_status_valid",
    "ck_guests_plus_one_rsvp_valid",
    "ck_guests_table_number_positive",
    "ck_guests_seat_number_positive",
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
def constrained_connection() -> Iterator[object]:
    connection = engine.connect()
    transaction = connection.begin()
    try:
        connection.exec_driver_sql(migration_sql_without_outer_transaction())
        yield connection
    finally:
        transaction.rollback()
        connection.close()


def unique_email(label: str) -> str:
    return f"pytest-constraint-{label}-{uuid4().hex}@example.com"


def insert_guest(connection: object, **overrides: object) -> None:
    values = {
        "wedding_id": 1,
        "name": "Constraint Test Guest",
        "email": unique_email("valid"),
        "rsvp_status": "pending",
        "table_number": None,
        "seat_number": None,
    }
    values.update(overrides)
    connection.execute(
        text(
            """
            INSERT INTO guests (
              wedding_id,
              name,
              email,
              rsvp_status,
              table_number,
              seat_number
            )
            VALUES (
              :wedding_id,
              :name,
              :email,
              :rsvp_status,
              :table_number,
              :seat_number
            )
            """
        ),
        values,
    )


def assert_rejected(connection: object, exc_type: type[Exception] | tuple[type[Exception], ...], **overrides: object) -> None:
    with pytest.raises(exc_type):
        with connection.begin_nested():
            insert_guest(connection, **overrides)


def test_guest_model_defines_constraints() -> None:
    constraint_names = {
        constraint.name for constraint in Guest.__table__.constraints if constraint.name
    }

    assert EXPECTED_GUEST_CONSTRAINTS.issubset(constraint_names)
    assert Guest.__table__.c.rsvp_status.nullable is False
    assert Guest.__table__.c.created_at.nullable is False
    assert Guest.__table__.c.updated_at.nullable is False


def test_constraints_migration_is_idempotent_and_preserves_optional_email() -> None:
    sql = MIGRATION_PATH.read_text()

    for constraint_name in EXPECTED_GUEST_CONSTRAINTS:
        assert constraint_name in sql
    assert sql.count("IF NOT EXISTS") >= len(EXPECTED_GUEST_CONSTRAINTS)
    assert "ALTER COLUMN email SET NOT NULL" not in sql


def test_guest_constraints_reject_invalid_rows(constrained_connection: object) -> None:
    duplicate_email = unique_email("duplicate")
    insert_guest(constrained_connection, email=duplicate_email)

    assert_rejected(constrained_connection, IntegrityError, email=duplicate_email)
    assert_rejected(constrained_connection, IntegrityError, name="   ")
    assert_rejected(constrained_connection, IntegrityError, email="not-an-email")
    assert_rejected(constrained_connection, IntegrityError, rsvp_status=None)
    assert_rejected(constrained_connection, (DataError, IntegrityError), rsvp_status="maybe")
    assert_rejected(constrained_connection, IntegrityError, table_number=0)
    assert_rejected(constrained_connection, IntegrityError, seat_number=0)


def test_guest_constraints_accept_valid_optional_email_row(
    constrained_connection: object,
) -> None:
    insert_guest(constrained_connection, email=None, table_number=1, seat_number=1)


class FakeDiag:
    constraint_name = "uq_guests_wedding_email"


class FakeOrig:
    diag = FakeDiag()


class FakeIntegrityError:
    orig = FakeOrig()


def test_guest_constraint_message_maps_duplicate_email() -> None:
    assert (
        guest_constraint_message(FakeIntegrityError(), "created")
        == "Guest email already exists for this wedding"
    )

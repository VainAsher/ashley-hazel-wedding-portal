from pathlib import Path

from app.db.models import Guest


EXPECTED_GUEST_INDEXES = {
    "idx_guests_email",
    "idx_guests_name",
    "idx_guests_created_at",
    "idx_guests_wedding_rsvp",
    "idx_guests_wedding_created",
    "idx_guests_table_assignment",
}


def test_guest_model_declares_performance_indexes() -> None:
    index_names = {index.name for index in Guest.__table__.indexes}

    assert EXPECTED_GUEST_INDEXES.issubset(index_names)


def test_index_migration_is_idempotent() -> None:
    migration = Path(__file__).parents[2] / "database" / "migrations" / "002_add_indexes.sql"
    sql = migration.read_text(encoding="utf-8")

    assert "CREATE INDEX IF NOT EXISTS idx_guests_email" in sql
    assert "CREATE INDEX IF NOT EXISTS idx_tasks_wedding_status_due" in sql
    assert "CREATE INDEX idx_" not in sql

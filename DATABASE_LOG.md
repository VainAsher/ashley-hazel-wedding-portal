# Wedding Dashboard Database Log

## 2026-06-10 - TASK-001: Import Database Schema

### Summary
Imported the full production database schema into the `wedding` PostgreSQL database on the development VM.

### Source
- File: `production/database/schema.sql`
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/5
- Commit: `207ef7d`

### Database Result
- Database: `wedding`
- Application role: `wedding_dev`
- Public base tables: 13
- Foreign key constraints: 18
- Import result: successful

### Tables Verified
- `attire`
- `budget_categories`
- `budget_items`
- `events`
- `gifts`
- `guests`
- `seating_arrangements`
- `tables`
- `tasks`
- `users`
- `vendors`
- `wedding_party`
- `weddings`

### Seed Data After Import
- `budget_categories`: 12 rows
- `weddings`: 1 row
- `users`: 3 rows
- `wedding_party`: 4 rows
- Other imported tables: 0 rows

### Verification Performed
- Confirmed password authentication for the documented `wedding_dev` connection path.
- Ran the schema import with `psql` against the `wedding` database.
- Verified all public tables with `\dt`.
- Verified foreign key count through `information_schema.table_constraints`.
- Verified `SELECT COUNT(*) FROM guests;` succeeds.
- Verified row counts for every imported table.

### Notes
The task checklist references 11 tables, but the schema contains 13. The additional tables are `gifts` and `attire`; both were imported because they are part of the full schema file.

## 2026-06-10 - TASK-002: Guest SQLAlchemy Model

### Summary
Added SQLAlchemy model coverage for guest management and the database session helper used by upcoming API endpoints.

### Source
- Models: `production/backend/app/db/models.py`
- Session helper: `production/backend/app/db/database.py`
- Package exports: `production/backend/app/db/__init__.py`
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/7
- Commit: `4a8787b`

### Model Result
- Added shared `Base` using SQLAlchemy 2 declarative mapping.
- Added `RsvpStatus` mapping for the existing PostgreSQL `rsvp_status` enum.
- Added `Wedding` model for `Guest.wedding` relationship support.
- Added `Guest` model with 16 columns mapped from the live `guests` table.
- Added `SessionLocal`, `engine`, and FastAPI-compatible `get_db` dependency.

### Verification Performed
- Imported `Base`, `Guest`, `RsvpStatus`, and `Wedding` successfully.
- Verified `Guest.__tablename__ == "guests"`.
- Verified the model maps 16 columns.
- Verified `Base.metadata.tables` includes `guests` and `weddings`.
- Queried the live database through `SessionLocal` with `db.query(Guest).count()`.
- Ran `PYTHONPATH=. venv/bin/python -m compileall app/db`.

### Notes
The model follows the imported schema from TASK-001. It intentionally does not use the simplified `first_name`/`last_name` fields shown in the task example because those columns do not exist in the live schema.

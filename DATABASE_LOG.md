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

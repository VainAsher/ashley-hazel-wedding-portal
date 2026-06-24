# Database Migrations

SQL migration files for the wedding dashboard database.

## Naming Convention
- `001_init_schema.sql` — initial schema (the live schema actually lives in
  `../schema.sql`; see "Apply Model" below).
- `NNN_description.sql` — subsequent migrations, applied in ascending numeric order.

## Migration Inventory

| File | Purpose |
| --- | --- |
| `002_add_indexes.sql` | Strategic indexes on `guests` for lookup, RSVP filtering, list ordering, and seating. |
| `003_add_constraints.sql` | Guest integrity constraints (NOT NULLs, unique email per wedding, name/email/RSVP/seat checks). |
| `004_create_audit_triggers.sql` | `guest_audit` table + `log_guest_changes()` trigger for INSERT/UPDATE/DELETE history. |
| `005_create_invites_table.sql` | `invites` table for invite-code auth, with code/role check constraints and indexes. |
| `006_add_rsvp_fields.sql` | Adds `meal_choice` and `dietary_notes` columns to `guests`. |
| `007_create_tasks_table.sql` | `tasks` table (status/priority/assignment) with FKs and indexes. |
| `008_seed_test_data.sql` | ⚠️ DESTRUCTIVE TEST SEED — see warning below. |
| `009_create_communications_and_gallery.sql` | `communications` and `gallery_items` tables with indexes. |
| `010_add_wedding_phase.sql` | Adds `phase` lifecycle column (`planning`/`live`/`event`/`archived`) to `weddings`. |
| `011_create_blessings.sql` | `blessings` guestbook table (author/message/hidden) with indexes. |

All migrations are written to be idempotent (`IF NOT EXISTS`, guarded `ALTER`s,
`CREATE OR REPLACE`, conditional constraint adds) so a rerun is safe.

## Apply Model

There are two distinct application paths:

1. **`../schema.sql` runs once, at first boot only.** It is mounted into the
   Postgres container's `docker-entrypoint-initdb.d`, so PostgreSQL's `initdb`
   executes it exactly once when the data directory is empty. It is **not**
   re-run on later boots.
2. **Numbered migrations are applied by `production/scripts/deploy.sh`
   (`apply_migrations`)** against the already-running, healthy database, after
   `schema.sql`. The function:
   - ensures a `schema_migrations (filename, applied_at)` ledger table exists;
   - iterates `for f in migrations/[0-9]*.sql` (numeric prefix only — `README.md`
     is skipped);
   - applies each file not already recorded in the ledger, then records it.

   Because the ledger gates each file by name, every migration is applied **once
   per environment** even across repeated deploys. CI applies the same files via
   `psql` using an explicit ordered list rather than relying solely on the glob.

> ⚠️ **`008_seed_test_data.sql` is a DESTRUCTIVE TEST SEED.**
> It runs `DELETE FROM invites/guests/users/wedding_party WHERE wedding_id = 1`
> and then re-inserts the `wedding_id = 1` "Ashley & Hazel" demo data (demo
> guests + `DEMO-COUPLE`/`DEMO-COORDINATOR`/`DEMO-GUEST` invites).
>
> **Current reality:** this file sits in the numbered-migrations directory, so
> `deploy.sh`'s `[0-9]*.sql` glob picks it up and applies it — once per
> environment via the `schema_migrations` ledger. That is acceptable for
> staging and CI.
>
> **Risk:** on a real production wedding database it will delete and overwrite
> the `wedding_id = 1` records with demo data the first time it is applied. It
> has **not** been fixed/fenced. Before deploying against a real production
> wedding DB it MUST be moved out of the migrations directory, renamed off the
> `[0-9]*.sql` pattern, or otherwise excluded from `apply_migrations`.

## Applying a Single Migration Manually
```bash
cd ~/wedding-dashboard/production/backend
set -a && . ./.env && set +a
cd ../database
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/NNN_description.sql
```

> This project uses raw SQL migrations applied by `psql`/`deploy.sh`. It does
> **not** use Alembic or any ORM-driven migration tool.

# Database Constraints Strategy

Week 2 Task 005 adds database-level integrity checks for the guest workflow.
The goal is to keep invalid data out of PostgreSQL even when writes bypass API
validation.

## Scope

The current production backend exposes wedding and guest models. Existing schema
definitions already provide primary keys, foreign keys, and several uniqueness
rules across the wider wedding dashboard schema. This task hardens the active
guest workflow without changing the current API contract.

Guest email remains optional because guest records can represent household
members or attendees without a known email address. When an email is present, it
must be valid and unique within the same wedding.

## Added Guest Constraints

| Constraint | Type | Purpose |
| --- | --- | --- |
| `rsvp_status NOT NULL` | Required field | Every guest has a lifecycle state. |
| `created_at NOT NULL` | Required field | Audit timestamps must always exist. |
| `updated_at NOT NULL` | Required field | Audit timestamps must always exist. |
| `uq_guests_wedding_email` | Unique | Prevent duplicate guest emails within one wedding while allowing separate weddings to reuse an address. |
| `ck_guests_name_not_blank` | Check | Reject blank names that satisfy only `NOT NULL`. |
| `ck_guests_email_format` | Check | Require a simple `local@domain.tld` shape when email is provided. |
| `ck_guests_rsvp_status_valid` | Check | Mirrors the PostgreSQL `rsvp_status` enum values for explicit schema visibility. |
| `ck_guests_plus_one_rsvp_valid` | Check | Mirrors the enum rule for optional plus-one RSVP state. |
| `ck_guests_table_number_positive` | Check | Reject zero or negative table assignments. |
| `ck_guests_seat_number_positive` | Check | Reject zero or negative seat assignments. |

## Existing Integrity Rules

The base schema already includes these relationship and uniqueness rules:

- `guests.wedding_id` references `weddings(id)` with `ON DELETE CASCADE`.
- `wedding_party.wedding_id`, `users.wedding_id`, `vendors.wedding_id`,
  `budget_items.wedding_id`, `events.wedding_id`, `tasks.wedding_id`,
  `tables.wedding_id`, `gifts.wedding_id`, and `attire.wedding_id` all reference
  parent tables.
- `users.email` is globally unique.
- `tables` has a unique `(wedding_id, table_number)` rule.
- `seating_arrangements` has a unique `(table_id, guest_id)` rule.

## Migration Approach

`003_add_constraints.sql` is safe to rerun:

- `ALTER COLUMN ... SET NOT NULL` and `SET DEFAULT` are idempotent.
- Named table constraints are added inside `IF NOT EXISTS` checks against
  `pg_constraint`.
- Existing null `rsvp_status`, `created_at`, and `updated_at` values are backfilled
  before the columns are marked required.

If duplicate guest emails already exist inside the same wedding, PostgreSQL will
reject `uq_guests_wedding_email`. Resolve duplicates before applying the
migration in that environment.

## Validation

Backend tests execute the migration inside a rollback-only transaction, then try
to insert invalid rows for duplicate emails, blank names, invalid email format,
missing RSVP status, invalid RSVP values, and invalid table or seat numbers.

Manual verification:

```bash
cd ~/wedding-dashboard/production/backend
set -a && . ./.env && set +a
cd ../database
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/003_add_constraints.sql
```

Inspect the installed constraints:

```sql
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'guests'::regclass
ORDER BY conname;
```

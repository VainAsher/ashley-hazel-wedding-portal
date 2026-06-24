# Database Audit Strategy

Week 2 Task 006 adds a database-managed audit trail for guest changes. The
audit trail is implemented in PostgreSQL so inserts, updates, and deletes are
captured even when writes bypass the FastAPI application.

## Scope

The audit trail currently covers the `guests` table **only**. No other table
(invites, tasks, communications, gallery, blessings, weddings, etc.) is audited
at the database level. Guests were chosen because they are the active backend
workflow and the table most affected by Week 2 database hardening. Additional
tables can reuse the same pattern with table-specific audit functions or a
generic audit function in a later task.

## Audit Table

`guest_audit` stores one row per guest mutation:

| Column | Purpose |
| --- | --- |
| `id` | Audit row primary key. |
| `guest_id` | Source guest ID, preserved even after guest deletion. |
| `wedding_id` | Wedding context for future filtering and reports. |
| `action` | `INSERT`, `UPDATE`, or `DELETE`. |
| `old_values` | JSONB snapshot before an update or delete. |
| `new_values` | JSONB snapshot after an insert or update. |
| `changed_at` | Database timestamp for the mutation. |
| `changed_by` | `app.changed_by` session setting when present, otherwise `CURRENT_USER`. |

`guest_id` intentionally does not reference `guests(id)`. A foreign key would
block or erase delete audit records, which defeats the purpose of preserving
history after a guest row is removed.

## Trigger Behavior

`log_guest_changes()` is attached to `guests` as an `AFTER INSERT OR UPDATE OR
DELETE` row trigger.

- Inserts write `new_values`.
- Updates write both `old_values` and `new_values`.
- Deletes write `old_values` and keep the deleted `guest_id`.

The migration is rerunnable:

- `guest_audit` is created with `CREATE TABLE IF NOT EXISTS`.
- Audit indexes use `CREATE INDEX IF NOT EXISTS`.
- The function is replaced with `CREATE OR REPLACE FUNCTION`.
- The trigger is dropped and recreated by name.

## Query Examples

View one guest's history:

```sql
SELECT action, old_values, new_values, changed_at, changed_by
FROM guest_audit
WHERE guest_id = 1
ORDER BY changed_at DESC;
```

Find recent guest changes:

```sql
SELECT guest_id, wedding_id, action, changed_at, changed_by
FROM guest_audit
ORDER BY changed_at DESC
LIMIT 25;
```

Find guests changed in the last day:

```sql
SELECT DISTINCT guest_id
FROM guest_audit
WHERE changed_at > NOW() - INTERVAL '24 hours'
ORDER BY guest_id;
```

## Application Actor

The trigger records `CURRENT_USER` by default. Application code can set a more
specific actor for the current transaction before changing guests:

```sql
SELECT set_config('app.changed_by', 'coordinator@example.com', true);
```

This is transaction-local when the third argument is `true`.

## Validation

Backend tests apply `004_create_audit_triggers.sql` inside a rollback-only
transaction, perform guest insert, update, and delete operations, and assert the
expected audit rows and JSONB snapshots. This validates the trigger behavior
without leaving audit tables or test rows in shared development databases before
the migration is merged.

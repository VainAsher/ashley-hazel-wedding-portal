# Database Indexing Strategy

## Goals

Indexes should support the highest-frequency dashboard reads without adding unnecessary write overhead. The Week 2 index set focuses on:

- Guest lookup by email and name.
- Guest RSVP filtering and created-date ordering within a wedding.
- Seating assignment lookups.
- Dashboard filters for vendors, budget items, tasks, events, gifts, and attire.
- Join paths that are not already covered by primary keys or unique constraints.

## Existing Baseline

The initial schema already indexed several foreign keys and simple filters:

- `guests(wedding_id)`
- `guests(rsvp_status)`
- `vendors(wedding_id)`
- `vendors(category_id)`
- `budget_items(wedding_id)`
- `budget_items(category_id)`
- `tasks(wedding_id)`
- `tasks(status)`
- `tasks(due_date)`
- `events(wedding_id)`
- `events(event_date)`
- `wedding_party(wedding_id)`
- `users(wedding_id)`

## Added Indexes

`002_add_indexes.sql` adds indexes for missing query patterns:

| Index | Supports |
|---|---|
| `idx_guests_email` | Guest lookup by email, partial because email is optional |
| `idx_guests_name` | Guest search/sort by name |
| `idx_guests_created_at` | Recent guest ordering |
| `idx_guests_wedding_rsvp` | RSVP dashboard filters within one wedding |
| `idx_guests_wedding_created` | Recent guest lists within one wedding |
| `idx_guests_table_assignment` | Seating assignment lookup by wedding/table/seat |
| `idx_vendors_wedding_contract` | Vendor contract status dashboard |
| `idx_budget_items_wedding_paid` | Paid/unpaid budget dashboard |
| `idx_tasks_wedding_status_due` | Task board by wedding, status, and due date |
| `idx_events_wedding_date` | Wedding timeline ordering |
| `idx_seating_arrangements_guest_id` | Guest-to-seat reverse lookup |
| `idx_gifts_wedding_status` | Registry status tracking |
| `idx_attire_wedding_status` | Attire status tracking |

## Write Cost

The indexes are limited to fields used in filters, ordering, and joins. Optional guest email and seating indexes are partial where useful to reduce index size and write cost.

Avoid adding indexes for every column. Add a new index only when a query pattern is known and verified with `EXPLAIN ANALYZE`.

## Verification

Run the migration:

```bash
cd ~/wedding-dashboard
set -a && . production/backend/.env && set +a
psql "$DATABASE_URL" -f production/database/migrations/002_add_indexes.sql
```

Verify an index exists:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_guests_email';
```

Verify the planner can use an index:

```sql
SET enable_seqscan = off;
EXPLAIN ANALYZE SELECT * FROM guests WHERE email = 'test@example.com';
RESET enable_seqscan;
```

For small development tables PostgreSQL may prefer sequential scans because the table is tiny. Use `enable_seqscan = off` only as a verification aid, not in application code.

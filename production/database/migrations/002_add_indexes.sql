-- Week 2 TASK-004: Strategic indexes for common reads and joins.
-- Idempotent so it can be applied safely more than once in development.

BEGIN;

-- Guest management: lookup, filtering, list ordering, and seating assignment.
CREATE INDEX IF NOT EXISTS idx_guests_email
  ON guests(email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_guests_name
  ON guests(name);

CREATE INDEX IF NOT EXISTS idx_guests_created_at
  ON guests(created_at);

CREATE INDEX IF NOT EXISTS idx_guests_wedding_rsvp
  ON guests(wedding_id, rsvp_status);

CREATE INDEX IF NOT EXISTS idx_guests_wedding_created
  ON guests(wedding_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guests_table_assignment
  ON guests(wedding_id, table_number, seat_number)
  WHERE table_number IS NOT NULL;

-- Operational dashboards: common filtered lists within one wedding.
CREATE INDEX IF NOT EXISTS idx_vendors_wedding_contract
  ON vendors(wedding_id, contract_signed);

CREATE INDEX IF NOT EXISTS idx_budget_items_wedding_paid
  ON budget_items(wedding_id, paid);

CREATE INDEX IF NOT EXISTS idx_tasks_wedding_status_due
  ON tasks(wedding_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_events_wedding_date
  ON events(wedding_id, event_date);

-- Join direction not covered by existing unique/foreign-key indexes.
CREATE INDEX IF NOT EXISTS idx_seating_arrangements_guest_id
  ON seating_arrangements(guest_id);

CREATE INDEX IF NOT EXISTS idx_gifts_wedding_status
  ON gifts(wedding_id, status);

CREATE INDEX IF NOT EXISTS idx_attire_wedding_status
  ON attire(wedding_id, status);

COMMIT;

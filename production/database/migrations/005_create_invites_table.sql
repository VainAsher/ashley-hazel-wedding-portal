-- Week 3 Task 016: Add invite-code authentication table.

BEGIN;

CREATE TABLE IF NOT EXISTS invites (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
  household_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'guest',
  redeemed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_invites_code_not_blank CHECK (length(btrim(code)) > 0),
  CONSTRAINT ck_invites_role_valid CHECK (role IN ('couple', 'coordinator', 'guest'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_code
  ON invites(code);

CREATE INDEX IF NOT EXISTS idx_invites_wedding_role
  ON invites(wedding_id, role);

CREATE INDEX IF NOT EXISTS idx_invites_guest_id
  ON invites(guest_id);

COMMIT;

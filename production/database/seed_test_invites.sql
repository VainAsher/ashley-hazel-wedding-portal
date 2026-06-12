-- Demo invite codes for local and staging validation.
-- Apply after migrations/005_create_invites_table.sql.

BEGIN;

WITH demo_guest AS (
  INSERT INTO guests (
    wedding_id,
    name,
    email,
    relationship,
    rsvp_status
  )
  VALUES (
    1,
    'Test Guest',
    'demo-001@wedding.local',
    'test',
    'pending'
  )
  ON CONFLICT (wedding_id, email)
  DO UPDATE SET
    name = EXCLUDED.name,
    relationship = EXCLUDED.relationship
  RETURNING id
)
INSERT INTO invites (
  code,
  wedding_id,
  guest_id,
  household_name,
  role
)
SELECT
  'DEMO-001',
  1,
  id,
  'Test Guest',
  'guest'
FROM demo_guest
ON CONFLICT (code)
DO UPDATE SET
  guest_id = EXCLUDED.guest_id,
  household_name = EXCLUDED.household_name,
  role = EXCLUDED.role;

INSERT INTO invites (
  code,
  wedding_id,
  household_name,
  role
)
VALUES
  ('DEMO-COUPLE', 1, 'Ashley & Hazel', 'couple'),
  ('DEMO-COORD', 1, 'Coordinator', 'coordinator')
ON CONFLICT (code)
DO UPDATE SET
  household_name = EXCLUDED.household_name,
  role = EXCLUDED.role;

COMMIT;

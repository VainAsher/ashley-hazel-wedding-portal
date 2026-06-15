-- ============================================================================
-- TEST DATA SEEDING SCRIPT
-- ============================================================================
-- Seeds test database with valid invites and guests for authentication testing.
--
-- This script:
-- 1. Creates/updates test wedding record
-- 2. Seeds invite codes: DEMO-COUPLE, DEMO-COORDINATOR, DEMO-GUEST
-- 3. Creates associated guest records
-- 4. Is idempotent (safe to run multiple times)
--
-- Usage:
--   psql -U postgres -d wedding < seed_test_data.sql
-- ============================================================================

BEGIN;

-- Set transaction isolation to prevent conflicts
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- ============================================================================
-- STEP 1: Ensure test wedding exists
-- ============================================================================

-- Create or update the test wedding record (ID = 1)
-- Using INSERT ... ON CONFLICT to be idempotent
INSERT INTO weddings (id, couple_names, wedding_date, created_at, updated_at)
VALUES (
    1,
    'Ashley & Hazel',
    '2026-06-20'::DATE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
    couple_names = EXCLUDED.couple_names,
    wedding_date = EXCLUDED.wedding_date,
    updated_at = CURRENT_TIMESTAMP;

-- Verify wedding was created/updated
DO $$
DECLARE
    v_wedding_id INT;
    v_couple_names VARCHAR;
BEGIN
    SELECT id, couple_names INTO v_wedding_id, v_couple_names
    FROM weddings WHERE id = 1;
    RAISE NOTICE 'Test wedding: % (ID: %)', v_couple_names, v_wedding_id;
END $$;

-- ============================================================================
-- STEP 2: Seed test guests (before invites, since invites reference guests)
-- ============================================================================

-- Demo guest for DEMO-GUEST invite
-- Using INSERT ... ON CONFLICT to be idempotent
INSERT INTO guests (
    wedding_id,
    name,
    email,
    phone,
    relationship,
    rsvp_status,
    created_at,
    updated_at
)
VALUES (
    1,
    'Demo Guest',
    'demo-guest@example.com',
    '555-0100',
    'friend',
    'pending'::rsvp_status,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (wedding_id, email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    relationship = EXCLUDED.relationship,
    updated_at = CURRENT_TIMESTAMP;

-- Additional test guests for guest list testing
INSERT INTO guests (
    wedding_id,
    name,
    email,
    phone,
    relationship,
    rsvp_status,
    created_at,
    updated_at
)
VALUES
    (1, 'Alice Anderson', 'demo-guest-1@example.com', '555-0101', 'friend', 'pending'::rsvp_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (1, 'Bob Butler', 'demo-guest-2@example.com', '555-0102', 'friend', 'pending'::rsvp_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (1, 'Carol Chen', 'demo-guest-3@example.com', '555-0103', 'friend', 'pending'::rsvp_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (1, 'David Davis', 'demo-guest-4@example.com', '555-0104', 'friend', 'pending'::rsvp_status, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (wedding_id, email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    relationship = EXCLUDED.relationship,
    updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- STEP 3: Seed invite codes
-- ============================================================================

-- DEMO-COUPLE invite (no guest associated)
INSERT INTO invites (
    code,
    wedding_id,
    guest_id,
    household_name,
    role,
    created_at,
    updated_at
)
VALUES (
    'DEMO-COUPLE',
    1,
    NULL,
    'Demo Couple',
    'couple',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- DEMO-COORDINATOR invite (no guest associated)
INSERT INTO invites (
    code,
    wedding_id,
    guest_id,
    household_name,
    role,
    created_at,
    updated_at
)
VALUES (
    'DEMO-COORDINATOR',
    1,
    NULL,
    'Demo Coordinator',
    'coordinator',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- DEMO-GUEST invite (linked to Demo Guest)
INSERT INTO invites (
    code,
    wedding_id,
    guest_id,
    household_name,
    role,
    created_at,
    updated_at
)
VALUES (
    'DEMO-GUEST',
    1,
    (SELECT id FROM guests WHERE wedding_id = 1 AND email = 'demo-guest@example.com'),
    'Demo Guest Household',
    'guest',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 4: Verification
-- ============================================================================

-- Summary of seeded data
DO $$
DECLARE
    v_invite_count INT;
    v_guest_count INT;
BEGIN
    SELECT COUNT(*) INTO v_invite_count FROM invites WHERE wedding_id = 1;
    SELECT COUNT(*) INTO v_guest_count FROM guests WHERE wedding_id = 1;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'TEST DATA SEEDING COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Total invites: %', v_invite_count;
    RAISE NOTICE 'Total guests: %', v_guest_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Test Invite Codes:';
    RAISE NOTICE '  - DEMO-COUPLE (couple role)';
    RAISE NOTICE '  - DEMO-COORDINATOR (coordinator role)';
    RAISE NOTICE '  - DEMO-GUEST (guest role)';
    RAISE NOTICE '';
    RAISE NOTICE 'Example login:';
    RAISE NOTICE '  POST /api/auth/login';
    RAISE NOTICE '  {"invite_code": "DEMO-COUPLE"}';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- Display all seeded invites
RAISE NOTICE 'Seeded Invites:';
SELECT
    code,
    role,
    COALESCE(g.name, 'N/A') as guest_name
FROM invites i
LEFT JOIN guests g ON i.guest_id = g.id
WHERE i.wedding_id = 1;

COMMIT;

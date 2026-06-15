-- Test Data Seeding for CI/CD Pipeline
-- This migration seeds test data required for frontend and backend test suites
-- Data includes: test wedding, couples, coordinators, guests with valid invite codes

BEGIN;

-- Clear any existing test data (safe in test environment)
DELETE FROM invites WHERE wedding_id = 1;
DELETE FROM guests WHERE wedding_id = 1;
DELETE FROM users WHERE wedding_id = 1;
DELETE FROM wedding_party WHERE wedding_id = 1;

-- Wedding (ID 1 is inserted in schema.sql, ensure it exists)
INSERT INTO weddings (id, couple_names, wedding_date, ceremony_time, ceremony_location, reception_location)
VALUES (1, 'Ashley & Hazel', '2026-06-20', '14:00:00', 'Test Venue', 'Test Reception Hall')
ON CONFLICT (id) DO UPDATE SET
  couple_names = 'Ashley & Hazel',
  wedding_date = '2026-06-20';

-- Wedding Party
INSERT INTO wedding_party (wedding_id, name, role, email)
VALUES
  (1, 'Ashley', 'groom', 'asher@example.com'),
  (1, 'Hazel', 'bride', 'hazel@example.com'),
  (1, 'Samson', 'best_man', 'samson@example.com'),
  (1, 'Kelly', 'bridesmaid', 'kelly@example.com')
ON CONFLICT (wedding_id, name, role) DO NOTHING;

-- Users (for authentication and role-based access)
INSERT INTO users (wedding_id, name, email, role, is_active)
VALUES
  (1, 'Wedding Coordinator', 'coordinator@wedding.local', 'coordinator', TRUE),
  (1, 'Ashley', 'ashley@wedding.local', 'couple', TRUE),
  (1, 'Hazel', 'hazel@wedding.local', 'couple', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Test Guests
INSERT INTO guests (wedding_id, name, email, phone, relationship, rsvp_status, created_at)
VALUES
  (1, 'John Smith', 'john.smith@example.com', '555-0001', 'family', 'pending', CURRENT_TIMESTAMP),
  (1, 'Jane Doe', 'jane.doe@example.com', '555-0002', 'friend', 'pending', CURRENT_TIMESTAMP),
  (1, 'Bob Johnson', 'bob.johnson@example.com', '555-0003', 'work', 'pending', CURRENT_TIMESTAMP),
  (1, 'Alice Brown', 'alice.brown@example.com', '555-0004', 'family', 'pending', CURRENT_TIMESTAMP),
  (1, 'Charlie Wilson', 'charlie.wilson@example.com', '555-0005', 'friend', 'pending', CURRENT_TIMESTAMP)
ON CONFLICT (wedding_id, email) DO NOTHING;

-- Test Invite Codes
-- Couple invites (for testing couple login flow)
INSERT INTO invites (code, wedding_id, role, household_name, created_at)
VALUES
  ('COUPLE-TEST-001', 1, 'couple', 'Ashley & Hazel', CURRENT_TIMESTAMP),
  ('COUPLE-TEST-002', 1, 'couple', 'Ashley & Hazel', CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;

-- Coordinator invites (for testing coordinator access)
INSERT INTO invites (code, wedding_id, role, household_name, created_at)
VALUES
  ('COORDINATOR-001', 1, 'coordinator', 'Wedding Coordinator', CURRENT_TIMESTAMP),
  ('COORDINATOR-002', 1, 'coordinator', 'Assistant Coordinator', CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;

-- Guest invites (linked to guest records)
INSERT INTO invites (code, wedding_id, guest_id, role, household_name, created_at)
SELECT 'GUEST-SMITH-001', 1, id, 'guest', 'Smith Family', CURRENT_TIMESTAMP
FROM guests WHERE email = 'john.smith@example.com' AND wedding_id = 1
ON CONFLICT (code) DO NOTHING;

INSERT INTO invites (code, wedding_id, guest_id, role, household_name, created_at)
SELECT 'GUEST-DOE-001', 1, id, 'guest', 'Doe Household', CURRENT_TIMESTAMP
FROM guests WHERE email = 'jane.doe@example.com' AND wedding_id = 1
ON CONFLICT (code) DO NOTHING;

INSERT INTO invites (code, wedding_id, guest_id, role, household_name, created_at)
SELECT 'GUEST-JOHNSON-001', 1, id, 'guest', 'Johnson Family', CURRENT_TIMESTAMP
FROM guests WHERE email = 'bob.johnson@example.com' AND wedding_id = 1
ON CONFLICT (code) DO NOTHING;

INSERT INTO invites (code, wedding_id, guest_id, role, household_name, created_at)
SELECT 'GUEST-BROWN-001', 1, id, 'guest', 'Brown Household', CURRENT_TIMESTAMP
FROM guests WHERE email = 'alice.brown@example.com' AND wedding_id = 1
ON CONFLICT (code) DO NOTHING;

INSERT INTO invites (code, wedding_id, guest_id, role, household_name, created_at)
SELECT 'GUEST-WILSON-001', 1, id, 'guest', 'Wilson Family', CURRENT_TIMESTAMP
FROM guests WHERE email = 'charlie.wilson@example.com' AND wedding_id = 1
ON CONFLICT (code) DO NOTHING;

COMMIT;

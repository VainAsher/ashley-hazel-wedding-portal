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

-- Test Guests (emails must match test expectations in test_auth_with_seeds.py)
INSERT INTO guests (wedding_id, name, email, phone, relationship, rsvp_status, created_at)
VALUES
  (1, 'Demo Guest', 'demo-guest@example.com', '555-0001', 'friend', 'pending', CURRENT_TIMESTAMP),
  (1, 'Alice Anderson', 'demo-guest-1@example.com', '555-0002', 'friend', 'pending', CURRENT_TIMESTAMP),
  (1, 'Bob Butler', 'demo-guest-2@example.com', '555-0003', 'friend', 'pending', CURRENT_TIMESTAMP),
  (1, 'Carol Chen', 'demo-guest-3@example.com', '555-0004', 'friend', 'pending', CURRENT_TIMESTAMP),
  (1, 'David Davis', 'demo-guest-4@example.com', '555-0005', 'friend', 'pending', CURRENT_TIMESTAMP)
ON CONFLICT (wedding_id, email) DO NOTHING;

-- Test Invite Codes (must match test expectations in test_auth_with_seeds.py)
INSERT INTO invites (code, wedding_id, role, household_name, created_at)
VALUES
  ('DEMO-COUPLE', 1, 'couple', 'Ashley & Hazel', CURRENT_TIMESTAMP),
  ('DEMO-COORDINATOR', 1, 'coordinator', 'Wedding Coordinator', CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;

-- Guest invite linked to demo-guest@example.com
INSERT INTO invites (code, wedding_id, guest_id, role, household_name, created_at)
SELECT 'DEMO-GUEST', 1, id, 'guest', 'Demo Guest', CURRENT_TIMESTAMP
FROM guests WHERE email = 'demo-guest@example.com' AND wedding_id = 1
ON CONFLICT (code) DO NOTHING;

COMMIT;

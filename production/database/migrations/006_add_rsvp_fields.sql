-- Add guest-facing RSVP detail fields for Week 3 RSVP flow.

BEGIN;

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS meal_choice VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dietary_notes TEXT;

COMMIT;

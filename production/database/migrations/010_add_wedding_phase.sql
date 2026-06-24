-- Migration 010: wedding phase lifecycle
-- Adds a `phase` to weddings driving the portal lifecycle:
--   planning -> live -> event -> archived
-- Existing weddings default to 'live' so current guest RSVP behaviour is
-- preserved. Idempotent.

ALTER TABLE weddings
  ADD COLUMN IF NOT EXISTS phase VARCHAR(20) NOT NULL DEFAULT 'live';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'weddings' AND constraint_name = 'ck_weddings_phase_valid'
  ) THEN
    ALTER TABLE weddings
      ADD CONSTRAINT ck_weddings_phase_valid
      CHECK (phase IN ('planning', 'live', 'event', 'archived'));
  END IF;
END $$;

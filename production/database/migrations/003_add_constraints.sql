-- Week 2 Task 005: Add database constraints and validation.
-- This migration is idempotent and preserves the current API contract:
-- guest email remains optional, but when present it must be valid and unique
-- within a wedding.

BEGIN;

UPDATE guests
SET rsvp_status = 'pending'::rsvp_status
WHERE rsvp_status IS NULL;

UPDATE guests
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;

UPDATE guests
SET updated_at = CURRENT_TIMESTAMP
WHERE updated_at IS NULL;

ALTER TABLE guests
  ALTER COLUMN rsvp_status SET DEFAULT 'pending'::rsvp_status,
  ALTER COLUMN rsvp_status SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_guests_wedding_email'
      AND conrelid = 'guests'::regclass
  ) THEN
    ALTER TABLE guests
      ADD CONSTRAINT uq_guests_wedding_email UNIQUE (wedding_id, email);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_guests_name_not_blank'
      AND conrelid = 'guests'::regclass
  ) THEN
    ALTER TABLE guests
      ADD CONSTRAINT ck_guests_name_not_blank CHECK (length(btrim(name)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_guests_email_format'
      AND conrelid = 'guests'::regclass
  ) THEN
    ALTER TABLE guests
      ADD CONSTRAINT ck_guests_email_format CHECK (
        email IS NULL
        OR email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_guests_rsvp_status_valid'
      AND conrelid = 'guests'::regclass
  ) THEN
    ALTER TABLE guests
      ADD CONSTRAINT ck_guests_rsvp_status_valid CHECK (
        rsvp_status::text IN ('pending', 'accepted', 'declined', 'tentative')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_guests_plus_one_rsvp_valid'
      AND conrelid = 'guests'::regclass
  ) THEN
    ALTER TABLE guests
      ADD CONSTRAINT ck_guests_plus_one_rsvp_valid CHECK (
        plus_one_rsvp IS NULL
        OR plus_one_rsvp::text IN ('pending', 'accepted', 'declined', 'tentative')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_guests_table_number_positive'
      AND conrelid = 'guests'::regclass
  ) THEN
    ALTER TABLE guests
      ADD CONSTRAINT ck_guests_table_number_positive CHECK (
        table_number IS NULL OR table_number > 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_guests_seat_number_positive'
      AND conrelid = 'guests'::regclass
  ) THEN
    ALTER TABLE guests
      ADD CONSTRAINT ck_guests_seat_number_positive CHECK (
        seat_number IS NULL OR seat_number > 0
      );
  END IF;
END $$;

COMMIT;

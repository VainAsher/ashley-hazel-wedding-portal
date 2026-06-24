-- Migration 011: blessings (guest guestbook / well-wishes wall)
-- Guests leave a short message; the couple/coordinators can hide one if needed.
-- Idempotent.

CREATE TABLE IF NOT EXISTS blessings (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  author_name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_blessings_author_not_blank CHECK (length(btrim(author_name)) > 0),
  CONSTRAINT ck_blessings_message_not_blank CHECK (length(btrim(message)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_blessings_wedding ON blessings(wedding_id);
CREATE INDEX IF NOT EXISTS idx_blessings_wedding_hidden ON blessings(wedding_id, hidden);

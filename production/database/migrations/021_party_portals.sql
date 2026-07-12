-- Migration 021: Stag & Hen party portals (Wave 3 item 14, D1)
-- See docs/specs/PARTY_PORTALS_D1.md for the full contract. This ships:
--   - individual couple identity (partner_label, associated_party) so the
--     couple invite can be split into two without hardcoding names,
--   - guest party membership + a single-select Best Man/Maid of Honour
--     (party_admin) per party,
--   - a wedding-level party_visibility_mode dial,
--   - party_reveals (per-couple-invite reveal gating), party_messages
--     (blessings-pattern message board with pin/hide), and party_info
--     (free-text details blurb) tables.
-- Idempotent.

ALTER TABLE invites ADD COLUMN IF NOT EXISTS party VARCHAR(10);
ALTER TABLE invites ADD COLUMN IF NOT EXISTS party_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS party_title VARCHAR(50);
-- Display-only per couple invite; never used for access logic (that's
-- associated_party below), so renaming a partner never breaks access.
ALTER TABLE invites ADD COLUMN IF NOT EXISTS partner_label VARCHAR(50);
-- Which party is *this partner's own* do (meaningful only when role='couple').
ALTER TABLE invites ADD COLUMN IF NOT EXISTS associated_party VARCHAR(10);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'invites' AND constraint_name = 'ck_invites_party_valid'
  ) THEN
    ALTER TABLE invites
      ADD CONSTRAINT ck_invites_party_valid
      CHECK (party IN ('stag', 'hen') OR party IS NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'invites' AND constraint_name = 'ck_invites_associated_party_valid'
  ) THEN
    ALTER TABLE invites
      ADD CONSTRAINT ck_invites_associated_party_valid
      CHECK (associated_party IN ('stag', 'hen') OR associated_party IS NULL);
  END IF;
END $$;

-- DB-level backstop for the single Best Man/Maid of Honour per party: the
-- admin-flagging endpoint proactively clears the previous holder first (in
-- the same transaction), so this constraint should never actually fire in
-- normal use.
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_party_admin_per_party
  ON invites (wedding_id, party) WHERE party_admin = true;

-- The couple's cross-grant visibility dial (Settings -> "Party visibility").
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS party_visibility_mode VARCHAR(20) NOT NULL DEFAULT 'partner_visible';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'weddings' AND constraint_name = 'ck_weddings_party_visibility_mode_valid'
  ) THEN
    ALTER TABLE weddings
      ADD CONSTRAINT ck_weddings_party_visibility_mode_valid
      CHECK (party_visibility_mode IN ('partner_visible', 'locked'));
  END IF;
END $$;

-- One row per couple-invite-that-needs-gating for a given party. Absence of
-- a row falls back to the mode default for non-subjects only — subjects
-- with no row are always locked out, regardless of mode.
CREATE TABLE IF NOT EXISTS party_reveals (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  party VARCHAR(10) NOT NULL,
  invite_id INTEGER NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  revealed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_party_reveals_party_valid CHECK (party IN ('stag', 'hen')),
  CONSTRAINT uq_party_reveals_wedding_party_invite UNIQUE (wedding_id, party, invite_id)
);

CREATE INDEX IF NOT EXISTS idx_party_reveals_wedding_party ON party_reveals(wedding_id, party);

-- Party message board (blessings-pattern): author + hidden + pin, moderated
-- by that party's admin (Best Man/Maid of Honour).
CREATE TABLE IF NOT EXISTS party_messages (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  party VARCHAR(10) NOT NULL,
  invite_id INTEGER NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_party_messages_party_valid CHECK (party IN ('stag', 'hen'))
);

CREATE INDEX IF NOT EXISTS idx_party_messages_wedding_party ON party_messages(wedding_id, party);
CREATE INDEX IF NOT EXISTS idx_party_messages_wedding_party_hidden ON party_messages(wedding_id, party, hidden);

-- Free-text date/venue/plan blurb, editable by that party's admin.
CREATE TABLE IF NOT EXISTS party_info (
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  party VARCHAR(10) NOT NULL,
  details TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (wedding_id, party),
  CONSTRAINT ck_party_info_party_valid CHECK (party IN ('stag', 'hen'))
);

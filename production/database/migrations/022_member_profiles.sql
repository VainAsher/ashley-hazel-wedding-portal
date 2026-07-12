-- Migration 022: Wedding-party mini profiles (Wave 3 item 15)
-- See docs/specs/WEDDING_PARTY_PROFILES.md for the full contract. Profiles
-- are guest-visible (not party-only): a public "Meet the wedding party"
-- directory open to every logged-in guest, editable by the party member it
-- belongs to. Eligibility is any invite with party IS NOT NULL (a flagged
-- Stag or Hen member) — enforced at the API layer, not by a DB constraint,
-- since eligibility can change (a member could in principle be un-flagged)
-- without us wanting to cascade-delete their filled-in profile.
-- Idempotent.

CREATE TABLE IF NOT EXISTS member_profiles (
  id SERIAL PRIMARY KEY,
  invite_id INTEGER NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  role_title VARCHAR(100),
  about TEXT,
  best_known_for VARCHAR(200),
  favourite_song VARCHAR(200),
  photo_path VARCHAR(500),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_member_profiles_invite_id UNIQUE (invite_id)
);

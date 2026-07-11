-- Migration 018: Dancefloor v2 (song reactions + now playing)
-- Guests ♥ songs on the wall (one reaction per invite per song — the invite
-- is the durable identity), and the couple/coordinators pick the song that is
-- "currently playing" on the wedding day.
-- Idempotent.

CREATE TABLE IF NOT EXISTS song_reactions (
  id SERIAL PRIMARY KEY,
  song_request_id INTEGER NOT NULL REFERENCES song_requests(id) ON DELETE CASCADE,
  invite_id INTEGER NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_song_reactions_song_invite UNIQUE (song_request_id, invite_id)
);

CREATE INDEX IF NOT EXISTS idx_song_reactions_invite ON song_reactions(invite_id);

ALTER TABLE weddings ADD COLUMN IF NOT EXISTS now_playing_song_id INTEGER REFERENCES song_requests(id) ON DELETE SET NULL;

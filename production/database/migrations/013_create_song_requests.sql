-- Migration 013: song_requests (Dancefloor guest music requests)
-- Guests request songs for the playlist; the couple/coordinators curate the
-- wall, keep a DJ do-not-play list ('blocked'), and export the final pack.
-- Idempotent.

CREATE TABLE IF NOT EXISTS song_requests (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255),
  source_url VARCHAR(500),
  dedication VARCHAR(500),
  requested_by VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER,
  resolved_title VARCHAR(255),
  resolved_artist VARCHAR(255),
  artwork_url VARCHAR(500),
  spotify_track_id VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_song_requests_status CHECK (status IN ('pending', 'approved', 'rejected', 'blocked')),
  CONSTRAINT ck_song_requests_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT ck_song_requests_requested_by_not_blank CHECK (length(btrim(requested_by)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_song_requests_wedding_status ON song_requests(wedding_id, status);
CREATE INDEX IF NOT EXISTS idx_song_requests_wedding_created ON song_requests(wedding_id, created_at DESC);

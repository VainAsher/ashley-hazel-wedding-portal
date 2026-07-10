-- Migration 014: audio preview for the Dancefloor jukebox.
--
-- 30-second preview stream URL (iTunes Search API match, resolved server-side
-- when a request is approved). NULL = no preview matched yet; the guest
-- jukebox simply skips those songs.

ALTER TABLE song_requests ADD COLUMN IF NOT EXISTS preview_url VARCHAR(500);

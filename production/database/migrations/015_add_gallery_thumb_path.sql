-- Migration 015: gallery thumbnails.
--
-- Relative path (under the uploads root) of a ~480px-wide JPEG derivative
-- served in the gallery grid. NULL = no thumbnail yet (unsupported format,
-- generation failure, or an upload that predates thumbnails); the frontend
-- falls back to the full-size original.

ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS thumb_path VARCHAR(500);

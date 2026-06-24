-- Migration 009: Communications and Gallery
-- Adds tables backing the Communications (guest announcements/messages) and
-- Gallery (photo) admin modules. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS communications (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  body TEXT,
  channel VARCHAR(50) NOT NULL DEFAULT 'email',
  audience VARCHAR(50) NOT NULL DEFAULT 'all',
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  scheduled_for TIMESTAMP NULL,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_communications_channel CHECK (channel IN ('email', 'whatsapp', 'sms', 'announcement')),
  CONSTRAINT ck_communications_audience CHECK (audience IN ('all', 'attending', 'pending', 'declined')),
  CONSTRAINT ck_communications_status CHECK (status IN ('draft', 'scheduled', 'sent')),
  CONSTRAINT ck_communications_subject_not_blank CHECK (length(btrim(subject)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_communications_wedding ON communications(wedding_id);
CREATE INDEX IF NOT EXISTS idx_communications_wedding_status ON communications(wedding_id, status);

CREATE TABLE IF NOT EXISTS gallery_items (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  title VARCHAR(255),
  caption TEXT,
  file_path VARCHAR(500) NOT NULL,
  content_type VARCHAR(100),
  file_size INTEGER,
  uploaded_by VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'approved',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_gallery_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_gallery_wedding ON gallery_items(wedding_id);
CREATE INDEX IF NOT EXISTS idx_gallery_wedding_status ON gallery_items(wedding_id, status);

-- Migration 017: notifications (in-app member notifications, ROADMAP Wave 2 item 8)
-- The member dashboard becomes a communications surface: sending a
-- communication fans out one notification row per matching invite, and the
-- bell/Messages card in the portal read them back. The recipient is the
-- durable per-member identity: the invite (invites.id).
-- Also widens the communications audience enum with the member-group
-- audiences (guests/coordinators/wedding_party/stags/hens). The party
-- audiences match no invites until the Wave 3 party flags land, but the
-- enum ships now so drafts can target them.
-- Idempotent.

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  recipient_invite_id INTEGER NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT,
  link_path VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  CONSTRAINT ck_notifications_kind CHECK (kind IN ('communication', 'mention', 'system')),
  CONSTRAINT ck_notifications_title_not_blank CHECK (length(btrim(title)) > 0)
);

-- The hot query: "my notifications + unread count" per recipient.
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read
  ON notifications(recipient_invite_id, read_at);

-- Widen the audience check on communications (keeps the original RSVP-based
-- audiences so existing rows stay valid).
ALTER TABLE communications DROP CONSTRAINT IF EXISTS ck_communications_audience;
ALTER TABLE communications ADD CONSTRAINT ck_communications_audience
  CHECK (audience IN (
    'all', 'attending', 'pending', 'declined',
    'guests', 'coordinators', 'wedding_party', 'stags', 'hens'
  ));

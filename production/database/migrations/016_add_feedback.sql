-- Migration 016: feedback (in-site bug/idea feedback tool)
-- Any signed-in user (guests included) can flag a bug or share an idea from
-- any page; the couple/coordinators triage the queue in the admin.
-- Idempotent.

CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  submitted_by VARCHAR(255) NOT NULL,
  type VARCHAR(10) NOT NULL,
  message TEXT NOT NULL,
  page VARCHAR(200),
  role VARCHAR(30),
  viewport VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_feedback_type CHECK (type IN ('bug', 'idea')),
  CONSTRAINT ck_feedback_status CHECK (status IN ('new', 'triaged', 'done')),
  CONSTRAINT ck_feedback_message_not_blank CHECK (length(btrim(message)) > 0),
  CONSTRAINT ck_feedback_submitted_by_not_blank CHECK (length(btrim(submitted_by)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_feedback_wedding_status ON feedback(wedding_id, status);
CREATE INDEX IF NOT EXISTS idx_feedback_wedding_created ON feedback(wedding_id, created_at DESC);

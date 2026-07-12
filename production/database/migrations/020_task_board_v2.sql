-- Migration 020: Task board v2 (Kanban V2)
-- Adds `context` (wedding/stag/hen scoping, admin Timeline always uses
-- 'wedding' for now) and `position` (per-column ordering for drag & drop)
-- to tasks. Backfills position per (wedding_id, status) ordered by
-- created_at so existing boards get a stable initial order. Idempotent.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS context VARCHAR(20) NOT NULL DEFAULT 'wedding';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'tasks' AND constraint_name = 'tasks_context_valid'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_context_valid
      CHECK (context IN ('wedding', 'stag', 'hen'));
  END IF;
END $$;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS position INTEGER;

-- Backfill: number existing tasks 0..N per (wedding_id, status), ordered by
-- created_at, so today's boards keep a sensible column order once the UI
-- starts honouring `position`.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY wedding_id, status ORDER BY created_at, id
  ) - 1 AS rn
  FROM tasks
  WHERE position IS NULL
)
UPDATE tasks
SET position = ranked.rn
FROM ranked
WHERE tasks.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_tasks_wedding_context_status_position
  ON tasks (wedding_id, context, status, position);

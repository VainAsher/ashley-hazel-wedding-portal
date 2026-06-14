-- Create tasks table for planning/coordination
-- Tables: tasks
-- Purpose: Store planning tasks with status, priority, assignment

BEGIN;

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'not_started',
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',
  due_date DATE,
  assigned_to INTEGER,
  category VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_wedding_id FOREIGN KEY (wedding_id) REFERENCES weddings(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT tasks_status_valid CHECK (status IN ('not_started', 'in_progress', 'done', 'blocked')),
  CONSTRAINT tasks_priority_valid CHECK (priority IN ('low', 'medium', 'high'))
);

CREATE INDEX idx_tasks_wedding_id ON tasks(wedding_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_wedding_status ON tasks(wedding_id, status);

COMMIT;

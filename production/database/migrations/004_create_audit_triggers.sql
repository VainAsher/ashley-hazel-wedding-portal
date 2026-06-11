-- Week 2 Task 006: Create guest audit table and triggers.
-- Audit rows intentionally do not foreign-key back to guests so DELETE audit
-- records survive after the source guest row is removed.

BEGIN;

CREATE TABLE IF NOT EXISTS guest_audit (
  id SERIAL PRIMARY KEY,
  guest_id INTEGER NOT NULL,
  wedding_id INTEGER,
  action VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by VARCHAR(255) DEFAULT CURRENT_USER,
  CONSTRAINT ck_guest_audit_action CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX IF NOT EXISTS idx_guest_audit_guest_id
  ON guest_audit(guest_id);

CREATE INDEX IF NOT EXISTS idx_guest_audit_changed_at
  ON guest_audit(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_guest_audit_guest_changed_at
  ON guest_audit(guest_id, changed_at DESC);

CREATE OR REPLACE FUNCTION log_guest_changes()
RETURNS TRIGGER AS $$
DECLARE
  audit_actor VARCHAR(255);
BEGIN
  audit_actor := COALESCE(NULLIF(current_setting('app.changed_by', true), ''), CURRENT_USER);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO guest_audit (
      guest_id,
      wedding_id,
      action,
      new_values,
      changed_by
    )
    VALUES (
      NEW.id,
      NEW.wedding_id,
      'INSERT',
      to_jsonb(NEW),
      audit_actor
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO guest_audit (
      guest_id,
      wedding_id,
      action,
      old_values,
      new_values,
      changed_by
    )
    VALUES (
      NEW.id,
      NEW.wedding_id,
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW),
      audit_actor
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO guest_audit (
      guest_id,
      wedding_id,
      action,
      old_values,
      changed_by
    )
    VALUES (
      OLD.id,
      OLD.wedding_id,
      'DELETE',
      to_jsonb(OLD),
      audit_actor
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guests_audit ON guests;

CREATE TRIGGER trg_guests_audit
AFTER INSERT OR UPDATE OR DELETE ON guests
FOR EACH ROW
EXECUTE FUNCTION log_guest_changes();

COMMIT;

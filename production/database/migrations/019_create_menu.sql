-- Migration 019: menu builder (Wave 2 item 12)
-- The couple defines menu options in admin; nearer the day they flip
-- weddings.meal_selection_open and guests pick meals (for themselves and
-- their plus one) in RSVP. `course` ships in the schema for later grouping,
-- but the v1 UI treats the menu as one flat list.
-- Idempotent.

CREATE TABLE IF NOT EXISTS menu_options (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  course VARCHAR(20),
  is_vegetarian BOOLEAN DEFAULT FALSE,
  is_vegan BOOLEAN DEFAULT FALSE,
  is_gluten_free BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ck_menu_options_course CHECK (course IN ('starter', 'main', 'dessert') OR course IS NULL),
  CONSTRAINT ck_menu_options_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_menu_options_wedding ON menu_options(wedding_id);
CREATE INDEX IF NOT EXISTS idx_menu_options_wedding_active ON menu_options(wedding_id, active);

-- The couple's "menu is ready" switch: gates guest meal selection in RSVP.
ALTER TABLE weddings ADD COLUMN IF NOT EXISTS meal_selection_open BOOLEAN NOT NULL DEFAULT FALSE;

-- Plus-one meal pick (mirrors guests.meal_choice varchar semantics).
ALTER TABLE guests ADD COLUMN IF NOT EXISTS plus_one_meal_choice VARCHAR(120);

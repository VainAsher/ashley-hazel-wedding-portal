-- Ashley & Hazel Wedding Database Schema
-- Self-hosted PostgreSQL
-- Supports: Couple, Wedding Party, Coordinator, Guests, Vendors, Budget, Timeline, Tasks

-- ============================================================================
-- ENUMS & TYPES
-- ============================================================================

CREATE TYPE rsvp_status AS ENUM ('pending', 'accepted', 'declined', 'tentative');
CREATE TYPE task_status AS ENUM ('not_started', 'in_progress', 'completed', 'blocked');
CREATE TYPE gift_status AS ENUM ('registered', 'purchased', 'received', 'thank_you_sent');
CREATE TYPE user_role AS ENUM ('couple', 'wedding_party', 'coordinator', 'guest');

-- ============================================================================
-- CORE WEDDING RECORD
-- ============================================================================

CREATE TABLE weddings (
  id SERIAL PRIMARY KEY,
  couple_names VARCHAR(255) NOT NULL,
  wedding_date DATE NOT NULL,
  ceremony_time TIME,
  ceremony_location VARCHAR(255),
  reception_location VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PEOPLE MANAGEMENT
-- ============================================================================

CREATE TABLE wedding_party (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'groom', 'bride', 'best_man', 'bridesmaid', 'groomsman', 'maid_of_honor'
  email VARCHAR(255),
  phone VARCHAR(20),
  attire_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(wedding_id, name, role)
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role user_role NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE guests (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  relationship VARCHAR(100), -- 'family', 'friend', 'work', 'other'
  rsvp_status rsvp_status DEFAULT 'pending',
  meal_choice VARCHAR(100),
  dietary_notes TEXT,
  dietary_restrictions TEXT,
  plus_one_name VARCHAR(255),
  plus_one_rsvp rsvp_status,
  plus_one_dietary TEXT,
  table_number INTEGER,
  seat_number INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invites (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
  household_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'guest',
  redeemed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_invites_code_not_blank CHECK (length(btrim(code)) > 0),
  CONSTRAINT ck_invites_role_valid CHECK (role IN ('couple', 'coordinator', 'guest'))
);

-- ============================================================================
-- VENDORS & BUDGET
-- ============================================================================

CREATE TABLE budget_categories (
  id SERIAL PRIMARY KEY,
  category_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT
);

INSERT INTO budget_categories (category_name, description) VALUES
  ('Venue', 'Wedding and reception venue'),
  ('Catering', 'Food and beverages'),
  ('Photography', 'Professional photography services'),
  ('Videography', 'Professional videography services'),
  ('Flowers & Decor', 'Flowers, centerpieces, decorations'),
  ('Attire', 'Wedding dress, suits, accessories'),
  ('Hair & Makeup', 'Hair and makeup services'),
  ('Entertainment', 'Music, DJ, entertainment'),
  ('Transportation', 'Limos, shuttles, travel'),
  ('Lodging', 'Hotel rooms for guests'),
  ('Gifts', 'Wedding gifts and favors'),
  ('Miscellaneous', 'Other expenses');

CREATE TABLE vendors (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  vendor_name VARCHAR(255) NOT NULL,
  category_id INTEGER NOT NULL REFERENCES budget_categories(id),
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  website VARCHAR(255),
  contract_signed BOOLEAN DEFAULT FALSE,
  contract_file VARCHAR(500),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE budget_items (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  category_id INTEGER NOT NULL REFERENCES budget_categories(id),
  description VARCHAR(255) NOT NULL,
  estimated_cost DECIMAL(10, 2),
  actual_cost DECIMAL(10, 2),
  paid BOOLEAN DEFAULT FALSE,
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TIMELINE & EVENTS
-- ============================================================================

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  event_name VARCHAR(255) NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME,
  location VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TASK MANAGEMENT & COORDINATION
-- ============================================================================

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  task_name VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status task_status DEFAULT 'not_started',
  due_date DATE,
  priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  category VARCHAR(100), -- 'budget', 'guests', 'vendors', 'coordination', 'other'
  completed_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SEATING ARRANGEMENTS (for future use)
-- ============================================================================

CREATE TABLE tables (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL,
  capacity INTEGER DEFAULT 8,
  table_type VARCHAR(100), -- 'guest', 'sweetheart', 'family', 'kids'
  notes TEXT,
  UNIQUE(wedding_id, table_number)
);

CREATE TABLE seating_arrangements (
  id SERIAL PRIMARY KEY,
  table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  seat_number INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(table_id, guest_id)
);

-- ============================================================================
-- GIFTS & REGISTRY
-- ============================================================================

CREATE TABLE gifts (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- 'home', 'kitchen', 'experiences', 'other'
  priority VARCHAR(20) DEFAULT 'medium',
  purchased_by_guest_id INTEGER REFERENCES guests(id) ON DELETE SET NULL,
  status gift_status DEFAULT 'registered',
  received_date DATE,
  thank_you_sent_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ATTIRE TRACKING
-- ============================================================================

CREATE TABLE attire (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  wedding_party_id INTEGER NOT NULL REFERENCES wedding_party(id) ON DELETE CASCADE,
  item_type VARCHAR(100), -- 'dress', 'suit', 'shoes', 'accessories'
  description VARCHAR(255),
  color VARCHAR(100),
  size VARCHAR(20),
  ordered_from VARCHAR(255),
  order_date DATE,
  arrival_date DATE,
  status VARCHAR(50) DEFAULT 'ordered', -- 'planning', 'ordered', 'arrived', 'fitted', 'ready'
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_guests_wedding_id ON guests(wedding_id);
CREATE INDEX idx_guests_rsvp_status ON guests(rsvp_status);
CREATE UNIQUE INDEX idx_invites_code ON invites(code);
CREATE INDEX idx_invites_wedding_role ON invites(wedding_id, role);
CREATE INDEX idx_invites_guest_id ON invites(guest_id);
CREATE INDEX idx_vendors_wedding_id ON vendors(wedding_id);
CREATE INDEX idx_vendors_category ON vendors(category_id);
CREATE INDEX idx_budget_items_wedding_id ON budget_items(wedding_id);
CREATE INDEX idx_budget_items_category ON budget_items(category_id);
CREATE INDEX idx_tasks_wedding_id ON tasks(wedding_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_events_wedding_id ON events(wedding_id);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_wedding_party_wedding_id ON wedding_party(wedding_id);
CREATE INDEX idx_users_wedding_id ON users(wedding_id);

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Insert the wedding
INSERT INTO weddings (couple_names, wedding_date) VALUES
  ('Ashley & Hazel', '2026-06-20');

-- Insert wedding party
INSERT INTO wedding_party (wedding_id, name, role, email) VALUES
  (1, 'Ashley', 'groom', 'asher@example.com'),
  (1, 'Hazel', 'bride', 'hazel@example.com'),
  (1, 'Samson', 'best_man', 'samson@example.com'),
  (1, 'Kelly', 'bridesmaid', 'kelly@example.com');

-- Insert coordinator user
INSERT INTO users (wedding_id, name, email, role) VALUES
  (1, 'Wedding Coordinator', 'coordinator@wedding.local', 'coordinator');

-- Insert couple as users (for task assignment)
INSERT INTO users (wedding_id, name, email, role) VALUES
  (1, 'Ashley', 'ashley@wedding.local', 'couple'),
  (1, 'Hazel', 'hazel@wedding.local', 'couple');

# 🎯 WEEK 2 ACTION PLAN - Comprehensive Infrastructure & Security Hardening

**Date:** 2026-06-10  
**Sprint Duration:** One week (2026-06-10 to 2026-06-17)  
**Total Tasks:** 14  
**Estimated Duration:** 18-20 hours  
**Target Completion:** 100% of critical blockers + high-priority items  

---

## 📋 Executive Summary

Week 1 successfully delivered the frontend dashboard with synthetic data. Week 2 focuses on **critical security hardening and infrastructure maturity** before production deployment. Four independent technical reviews identified systemic issues that must be resolved before any backend integration or real data handling.

### Critical Path Dependencies
```
Phase 1 (Setup foundation)
├─ Task 001: .env configuration
├─ Task 002: Database migration framework
└─ Task 003: CORS configuration

Phase 2 (Database hardening)
├─ Task 004: Database constraints & NOT NULLs (depends on 002)
├─ Task 005: Create missing indexes (depends on 002)
├─ Task 006: Plus-one schema refactor (depends on 002, 004)
└─ Task 007: Update triggers (depends on 002, 004)

Phase 3 (Backend & API)
├─ Task 008: Rate limiting setup (depends on 001)
├─ Task 009: Email validation enhancement (depends on 001)
└─ Task 010: Database connection pooling (depends on 001)

Phase 4 (CI/CD & Testing)
├─ Task 011: CI/CD pipeline setup
├─ Task 012: Frontend unit tests
├─ Task 013: Error logging enhancement
└─ Task 014: Code review workflow
```

---

## 🚨 CRITICAL BLOCKERS (MUST FIX THIS WEEK)

These 3 items **block any production deployment** and should be addressed first:

### ✋ **1. CORS Misconfiguration (SECURITY CRITICAL)**

**Finding:** Backend allows `allow_origins=["*"]` - accepts requests from ANY domain

**Risk Level:** 🔴 **CRITICAL**  
**Blocks:** Production deployment, real data handling  
**Hours:** 1-1.5

#### Implementation
- [ ] Review current CORS configuration in backend
- [ ] Replace wildcard with explicit origin whitelist
- [ ] Add credentials handling
- [ ] Environment-based configuration

#### Acceptance Criteria
- [ ] Wildcard CORS removed
- [ ] Only expected origins allowed (localhost:3000, production domain, etc.)
- [ ] Options requests handled properly
- [ ] Credentials cookie policy set
- [ ] CORS preflight tested with curl/Postman

#### Files to Modify
- `production/backend/app/main.py` or equivalent FastAPI setup

#### Testing Strategy
```bash
# Test allowed origin
curl -H "Origin: http://192.168.0.32:3000" \
  -H "Access-Control-Request-Method: GET" \
  http://192.168.0.32:3001/api/guests -v

# Test blocked origin (should fail)
curl -H "Origin: http://malicious.com" \
  -H "Access-Control-Request-Method: GET" \
  http://192.168.0.32:3001/api/guests -v

# Verify header response
# Expected: Access-Control-Allow-Origin: http://192.168.0.32:3000
# NOT: Access-Control-Allow-Origin: *
```

#### Commit Message Template
```
fix(security): restrict CORS to explicit origin whitelist

- Remove wildcard allow_origins configuration
- Add environment-based origin configuration
- Implement proper credentials handling
- Add CORS preflight testing
```

---

### ✋ **2. Environment Variables & Credentials (SECURITY CRITICAL)**

**Finding:** Database credentials, API keys, and secrets hardcoded in source code

**Risk Level:** 🔴 **CRITICAL**  
**Blocks:** Git repository safety, production deployment  
**Hours:** 1.5-2

#### Implementation
- [ ] Create `.env.example` file (with dummy values)
- [ ] Create `.env` file (add to .gitignore)
- [ ] Replace all hardcoded values with env variables
- [ ] Use `python-dotenv` for backend
- [ ] Use `.env` parsing in frontend build
- [ ] Document all required env vars

#### Acceptance Criteria
- [ ] `.env.example` created with all variables documented
- [ ] `.env` created locally with valid values
- [ ] `.env` added to `.gitignore`
- [ ] All database connection strings use env vars
- [ ] All API keys use env vars
- [ ] All secrets use env vars
- [ ] Code contains no hardcoded credentials (verify with grep)
- [ ] Application runs with only `.env` file present

#### Files to Create/Modify
- Create: `.env.example`
- Create: `.env` (local only)
- Modify: `.gitignore` (ensure `.env` is ignored)
- Modify: `production/backend/app/main.py` (or db config)
- Modify: `production/backend/app/db/database.py`
- Modify: Frontend build config

#### Environment Variables Needed
```env
# Database
DATABASE_URL=postgresql://wedding_dev:password@192.168.0.32:5432/wedding
DB_HOST=192.168.0.32
DB_PORT=5432
DB_USER=wedding_dev
DB_PASSWORD=***
DB_NAME=wedding

# Backend
BACKEND_PORT=3001
BACKEND_HOST=0.0.0.0
ENVIRONMENT=development

# Frontend
VITE_API_URL=http://192.168.0.32:3001
VITE_ENVIRONMENT=development

# CORS
ALLOWED_ORIGINS=http://192.168.0.32:3000,http://localhost:3000

# Email (for validation tasks later)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=***
SMTP_PASSWORD=***
```

#### Testing Strategy
```bash
# Verify no credentials in git
git log --all -S "password" --source --oneline
git log --all -S "192.168.0.32:5432" --source --oneline

# Verify .env is gitignored
git check-ignore .env

# Verify app loads from .env
export DATABASE_URL="postgresql://..."
python -c "from app.db.database import SessionLocal; print(SessionLocal())"
```

#### Commit Message Template
```
fix(security): externalize all credentials to environment variables

- Create .env.example with all required variables
- Replace hardcoded credentials with env var references
- Add .env to .gitignore
- Document all environment variables required
- Verify no secrets remain in git history
```

---

### ✋ **3. Database Migration Framework (BLOCKS ALL DB WORK)**

**Finding:** No migration system exists; schema changes require direct SQL editing

**Risk Level:** 🔴 **CRITICAL**  
**Blocks:** Database schema changes, data model evolution, team collaboration  
**Hours:** 2-2.5

#### Implementation
- [ ] Choose migration tool: `Alembic` (Python standard for SQLAlchemy)
- [ ] Initialize Alembic in backend project
- [ ] Create baseline migration for current schema
- [ ] Set up automatic migration generation
- [ ] Document migration workflow
- [ ] Create migration testing approach

#### Acceptance Criteria
- [ ] Alembic initialized in `production/backend/alembic/`
- [ ] Current schema captured as baseline migration
- [ ] `alembic upgrade head` applies all migrations
- [ ] `alembic downgrade` works properly
- [ ] Migration history tracked in Git
- [ ] Documentation for adding new migrations
- [ ] Migrations tested on clean database
- [ ] Migration timestamps and names follow conventions

#### Files to Create/Modify
- Create: `production/backend/alembic/` (Alembic directory)
- Create: `production/backend/alembic/versions/001_baseline_schema.py`
- Create: `production/backend/alembic.ini`
- Create: `production/backend/alembic/env.py`
- Modify: `production/backend/app/db/database.py` (add alembic integration)
- Create: `MIGRATION_GUIDE.md` (documentation)

#### Directory Structure After
```
production/backend/
├── alembic/
│   ├── versions/
│   │   └── 001_baseline_schema.py
│   ├── env.py
│   └── script.py.mako
├── alembic.ini
├── app/
│   └── db/
│       ├── database.py
│       └── models.py
└── tests/
    └── test_migrations.py
```

#### Testing Strategy
```bash
# Test baseline migration
alembic upgrade head  # Should apply schema
alembic downgrade base  # Should undo everything
alembic upgrade head  # Should reapply

# Test in CI
python -m pytest tests/test_migrations.py

# Verify schema after migration
psql -h localhost -u wedding_dev -d wedding -c "\dt"
```

#### Commit Message Template
```
feat(database): implement Alembic migration framework

- Initialize Alembic with SQLAlchemy configuration
- Create baseline migration capturing current schema
- Document migration workflow and conventions
- Add migration testing to test suite
- Enable version-controlled schema changes
```

---

## 📊 HIGH PRIORITY ITEMS (WEEK 2)

Complete these after the 3 critical blockers:

### ✅ **Task 004: Database Constraints & NOT NULLs** (Depends on Task 003)

**Finding:** Required fields lack NOT NULL constraints; allows invalid data

**Risk Level:** 🟡 **HIGH**  
**Estimate:** 2 hours  
**Difficulty:** Medium  
**Blocks:** Data integrity, validation

#### Implementation
- [ ] Review schema for all required fields
- [ ] Create migration to add NOT NULL constraints
- [ ] Review which fields should have defaults
- [ ] Add unique constraint on email per wedding
- [ ] Add check constraints for enums

#### Fields Requiring NOT NULL
```sql
-- guests table
guests.wedding_id          -- Foreign key (required)
guests.name                -- Guest name (required)
guests.rsvp_status         -- Must have status

-- wedding_party table
wedding_party.wedding_id   -- Foreign key (required)
wedding_party.name         -- Name (required)
wedding_party.role         -- Role (required)

-- vendors table
vendors.wedding_id         -- Foreign key (required)
vendors.vendor_name        -- Name (required)
vendors.category           -- Category (required)

-- Similar for all other tables
```

#### Unique Constraints Needing Scope
```sql
-- Current: UNIQUE(email) - allows duplicates across weddings
-- Should be: UNIQUE(wedding_id, email) - per-wedding uniqueness
```

#### Acceptance Criteria
- [ ] All NOT NULL constraints added via migration
- [ ] Unique constraints scoped to wedding_id where needed
- [ ] Migration applies cleanly to existing database
- [ ] Downgrade restores original schema
- [ ] Documentation updated with constraint list

#### Testing Strategy
```bash
# Test NOT NULL constraint
psql -c "INSERT INTO guests (name) VALUES ('Test')" 
# Should fail with NOT NULL violation on wedding_id

# Test unique per wedding
psql -c "INSERT INTO guests (wedding_id, name, email) VALUES (1, 'A', 'test@ex.com')"
psql -c "INSERT INTO guests (wedding_id, name, email) VALUES (2, 'B', 'test@ex.com')"
# Second should succeed (different wedding)
```

#### Commit Message Template
```
feat(database): add NOT NULL constraints and scope unique constraints

- Add NOT NULL constraints to all required fields
- Scope UNIQUE(email) to UNIQUE(wedding_id, email)
- Add check constraints for enum fields
- Create migration for safe constraint addition
- Verify data integrity with tests
```

---

### ✅ **Task 005: Create Missing Database Indexes** (Depends on Task 003)

**Finding:** 8 critical indexes missing; queries will be slow on large datasets

**Risk Level:** 🟡 **HIGH**  
**Estimate:** 1.5 hours  
**Difficulty:** Medium  
**Blocks:** Query performance

#### Missing Indexes Identified
```sql
-- guests table
CREATE INDEX idx_guests_wedding_id ON guests(wedding_id);
CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_guests_rsvp_status ON guests(rsvp_status);
CREATE INDEX idx_guests_table_number ON guests(table_number);

-- vendors table
CREATE INDEX idx_vendors_wedding_id ON vendors(wedding_id);
CREATE INDEX idx_vendors_category ON vendors(category);

-- budget_items table
CREATE INDEX idx_budget_items_wedding_id ON budget_items(wedding_id);
CREATE INDEX idx_budget_items_category_id ON budget_items(category_id);

-- tasks table
CREATE INDEX idx_tasks_wedding_id ON tasks(wedding_id);
CREATE INDEX idx_tasks_status ON tasks(status);

-- events table
CREATE INDEX idx_events_wedding_id ON events(wedding_id);

-- Foreign key indexes (automatic in most DBs, but verify)
-- All REFERENCES columns should be indexed
```

#### Acceptance Criteria
- [ ] Migration creates all 8+ indexes
- [ ] Foreign key columns all indexed
- [ ] Frequently-filtered columns indexed
- [ ] Sorting columns indexed (updated_at)
- [ ] Composite indexes created where needed
- [ ] EXPLAIN ANALYZE shows index usage

#### Testing Strategy
```bash
# Verify indexes created
SELECT * FROM pg_indexes WHERE schemaname = 'public';

# Test query performance
EXPLAIN ANALYZE SELECT * FROM guests WHERE wedding_id = 1;
# Should show "Index Scan" not "Seq Scan"

# Run performance baseline
time psql -c "SELECT COUNT(*) FROM guests WHERE rsvp_status = 'accepted';"
```

#### Composite Index Candidates
```sql
-- For common queries
CREATE INDEX idx_guests_wedding_status ON guests(wedding_id, rsvp_status);
CREATE INDEX idx_vendors_wedding_category ON vendors(wedding_id, category);
```

#### Commit Message Template
```
feat(database): add 8+ missing indexes for query performance

- Create indexes on all foreign key columns
- Create indexes on frequently-filtered columns
- Create indexes on sort columns (updated_at)
- Add composite indexes for common query patterns
- Verify index usage with EXPLAIN ANALYZE
```

---

### ✅ **Task 006: Refactor Plus-One Data Model** (Depends on Task 003, 004)

**Finding:** Plus-one violates 3NF; should be separate PlusOne table

**Risk Level:** 🟡 **HIGH**  
**Estimate:** 2 hours  
**Difficulty:** Medium  
**Blocks:** Clean data model

#### Current Schema Problem
```sql
CREATE TABLE guests (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  plus_one_name VARCHAR(255),        -- Violates 3NF
  plus_one_rsvp rsvp_status,         -- Violates 3NF
  plus_one_dietary TEXT,             -- Violates 3NF
  -- This allows guests without plus-ones to have null fields
  -- And makes plus-one a weak entity without proper relationships
);
```

#### Proposed Schema
```sql
CREATE TABLE guests (
  id SERIAL PRIMARY KEY,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  rsvp_status rsvp_status DEFAULT 'pending',
  dietary_restrictions TEXT,
  table_number INTEGER,
  seat_number INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE plus_ones (
  id SERIAL PRIMARY KEY,
  guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  rsvp_status rsvp_status DEFAULT 'pending',
  dietary_restrictions TEXT,
  table_number INTEGER,
  seat_number INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Migration Strategy
```sql
-- Migration steps:
-- 1. Create plus_ones table
-- 2. Copy data from guests.plus_one_* columns
-- 3. Drop plus_one_* columns from guests
-- 4. Add not-null constraints
-- 5. Verify referential integrity
```

#### Acceptance Criteria
- [ ] PlusOne table created
- [ ] Foreign key from plus_ones to guests
- [ ] Data migrated from denormalized format
- [ ] Old columns dropped from guests
- [ ] Migration includes rollback
- [ ] All queries updated to use new schema
- [ ] Tests updated for new schema

#### Testing Strategy
```bash
# Verify data integrity
SELECT g.id, g.name, 
  COALESCE((SELECT COUNT(*) FROM plus_ones WHERE guest_id = g.id), 0) as plus_one_count
FROM guests g;

# Test guest + plus-one queries
SELECT g.name as guest, p.name as plus_one 
FROM guests g 
LEFT JOIN plus_ones p ON g.id = p.guest_id 
WHERE g.wedding_id = 1;
```

#### Commit Message Template
```
refactor(database): normalize plus-one data into separate table

- Create PlusOne table with proper relationships
- Migrate data from denormalized guest columns
- Remove plus_one_* columns from guests table
- Update ORM models for new schema
- Add migration with rollback support
- Update all queries to use new schema
```

---

### ✅ **Task 007: Add Update Triggers for Timestamps** (Depends on Task 003)

**Finding:** `updated_at` fields not automatically updated; require manual management

**Risk Level:** 🟡 **HIGH**  
**Estimate:** 1 hour  
**Difficulty:** Easy  
**Blocks:** Data audit trail, cache invalidation

#### Implementation
Create trigger function that updates `updated_at` on any modification:

```sql
CREATE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER guests_update_timestamp BEFORE UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER vendors_update_timestamp BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ... for all tables
```

#### Acceptance Criteria
- [ ] Trigger function created
- [ ] Triggers applied to all 6+ tables with updated_at
- [ ] Manual updates to updated_at prevent overwrite
- [ ] Tested that UPDATE actually updates timestamp

#### Testing Strategy
```bash
# Test trigger
UPDATE guests SET name = 'New Name' WHERE id = 1;
SELECT updated_at FROM guests WHERE id = 1;
# updated_at should be CURRENT_TIMESTAMP

# Verify no manual timestamp possible to override
UPDATE guests SET updated_at = '2020-01-01' WHERE id = 1;
SELECT updated_at FROM guests WHERE id = 1;
# Should still be current time (trigger overrides)
```

#### Commit Message Template
```
feat(database): add update timestamp triggers

- Create trigger function for automatic timestamp update
- Apply to guests, vendors, budget_items, tasks, events, tables
- Verify trigger prevents stale updated_at values
- Enable audit trail through timestamps
```

---

### ✅ **Task 008: Implement Rate Limiting** (Depends on Task 001)

**Finding:** No rate limiting; API vulnerable to DOS/brute-force attacks

**Risk Level:** 🟡 **HIGH**  
**Estimate:** 1.5 hours  
**Difficulty:** Medium  
**Blocks:** Production API deployment

#### Implementation
Use `slowapi` (FastAPI rate limiting):

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@router.post("/guests", dependencies=[Depends(limiter.limit("100/hour"))])
async def create_guest(guest: GuestCreate):
    # ...
```

#### Rate Limit Policies
```
Public endpoints (guests list):     100 requests/hour per IP
Create operations:                   20 requests/hour per IP
Update/Delete operations:            10 requests/hour per IP
Email endpoints:                     5 requests/hour per IP
Login attempts:                      3 requests/hour per IP
```

#### Acceptance Criteria
- [ ] Rate limiting installed (`pip install slowapi`)
- [ ] Limiter configured with sensible defaults
- [ ] Different limits for different endpoint types
- [ ] Rate limit headers returned (X-RateLimit-*)
- [ ] Configuration environment-based
- [ ] Test exceeding rate limits returns 429

#### Testing Strategy
```bash
# Test rate limiting
for i in {1..105}; do
  curl http://192.168.0.32:3001/api/guests
done
# After 100 requests, should get 429 Too Many Requests

# Verify headers
curl -i http://192.168.0.32:3001/api/guests | grep X-RateLimit
# Expected: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

#### Commit Message Template
```
feat(security): implement rate limiting on API endpoints

- Add slowapi rate limiting middleware
- Configure tiered limits per endpoint type
- Environment-based limit configuration
- Add rate limit headers to responses
- Test exceeding limits returns 429
```

---

### ✅ **Task 009: Enhance Email Validation** (Depends on Task 001)

**Finding:** Email validation is too basic; doesn't check format properly

**Risk Level:** 🟡 **HIGH**  
**Estimate:** 1 hour  
**Difficulty:** Easy  
**Blocks:** Data quality

#### Current Issue
```python
# Current (too simple)
if "@" not in email:
    raise ValueError("Invalid email")
```

#### Implementation
```python
from pydantic import EmailStr, field_validator
import re

class GuestCreate(BaseModel):
    email: EmailStr  # Uses email-validator library
    
    @field_validator('email')
    @classmethod
    def validate_email_format(cls, v):
        if not re.match(r'^[^@]+@[^@]+\.[^@]+$', v):
            raise ValueError("Invalid email format")
        return v
```

#### Acceptance Criteria
- [ ] Use Pydantic `EmailStr` field type
- [ ] Install `email-validator` package
- [ ] Validate RFC 5322 format
- [ ] Check for common typos (gmail.com vs gmial.com)
- [ ] Reject disposable email addresses (optional)
- [ ] Test with valid/invalid emails

#### Testing Strategy
```bash
# Valid emails
test@example.com
user+tag@example.co.uk
first.last@company.org

# Invalid emails (should be rejected)
test@invalid
@example.com
test@.com
test@@example.com
test@example
```

#### Dependencies
```bash
pip install email-validator
```

#### Commit Message Template
```
feat(validation): improve email validation in guest creation

- Use Pydantic EmailStr for RFC 5322 validation
- Add email-validator package for comprehensive checks
- Validate against common typos
- Update API tests for validation edge cases
```

---

### ✅ **Task 010: Configure Database Connection Pooling** (Depends on Task 001)

**Finding:** No connection pooling; each request creates new DB connection

**Risk Level:** 🟡 **HIGH**  
**Estimate:** 1 hour  
**Difficulty:** Easy  
**Blocks:** Performance under load

#### Implementation
Use SQLAlchemy's built-in pooling:

```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,           # Connections in pool
    max_overflow=10,        # Additional connections allowed
    pool_recycle=3600,      # Recycle connections after 1 hour
    pool_pre_ping=True,     # Test connection before using
    echo=False
)
```

#### Configuration
```
pool_size=20           # Good for concurrent requests
max_overflow=10        # Allow burst traffic
pool_recycle=3600      # Prevent "connection lost" errors
pool_timeout=30        # Wait 30s for available connection
```

#### Acceptance Criteria
- [ ] Connection pool initialized
- [ ] Pool size configured (20 connections)
- [ ] Max overflow configured (10)
- [ ] Connection recycling enabled
- [ ] Health checks enabled (pool_pre_ping=True)
- [ ] Environment-based configuration
- [ ] Load test shows improvements

#### Testing Strategy
```bash
# Monitor connection count
# Before: Each request = 1 new connection
# After: Connections reused from pool

# Test connection pool with load
ab -n 1000 -c 50 http://192.168.0.32:3001/api/guests
# Should handle 50 concurrent requests efficiently
```

#### Commit Message Template
```
feat(database): enable connection pooling for performance

- Configure SQLAlchemy QueuePool with optimal settings
- Set pool_size=20, max_overflow=10
- Enable pool_pre_ping for connection health checks
- Implement connection recycling to prevent stale connections
- Test with load to verify improvements
```

---

## 📈 MEDIUM PRIORITY ITEMS (WEEK 2 if time)

### ✅ **Task 011: Frontend Unit Tests** (No dependencies)

**Finding:** No frontend unit tests; components untested

**Risk Level:** 🟠 **MEDIUM**  
**Estimate:** 2.5 hours  
**Difficulty:** Medium  

#### Scope
- Unit tests for GuestList component (fetching, rendering)
- Unit tests for GuestForm component (validation, submission)
- Mock API responses
- Test loading states and error states

#### Testing Tool: Vitest + React Testing Library

```typescript
// Example test
import { render, screen } from '@testing-library/react'
import { GuestList } from './GuestList'

describe('GuestList', () => {
  it('renders loading state', () => {
    render(<GuestList />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
  
  it('displays guests from API', async () => {
    // Mock API
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1, name: 'John' }])
      })
    )
    
    render(<GuestList />)
    expect(await screen.findByText('John')).toBeInTheDocument()
  })
})
```

#### Acceptance Criteria
- [ ] Vitest configured
- [ ] React Testing Library installed
- [ ] GuestList tests (fetch, render, error states)
- [ ] GuestForm tests (validation, submission, errors)
- [ ] Mock fetch for all tests
- [ ] >80% component coverage
- [ ] All tests passing

#### Commit Message Template
```
test(frontend): add unit tests for guest management components

- Configure Vitest as test runner
- Add React Testing Library for component testing
- Test GuestList component (fetch, render, errors)
- Test GuestForm component (validation, submit)
- Mock fetch for all API calls
- Achieve >80% component coverage
```

---

### ✅ **Task 012: CI/CD Pipeline Setup** (No dependencies)

**Finding:** No CI/CD; deployments manual and risky

**Risk Level:** 🟠 **MEDIUM**  
**Estimate:** 2-2.5 hours  
**Difficulty:** Medium  

#### Platform: GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: wedding_test
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r production/backend/requirements.txt
      - run: pytest production/backend/tests/

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd production/frontend && npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

#### Acceptance Criteria
- [ ] GitHub Actions workflow created
- [ ] Backend tests run on push
- [ ] Frontend tests run on push
- [ ] Database tests with PostgreSQL service
- [ ] Build verification (npm run build)
- [ ] Linting checks included
- [ ] Pull requests blocked if tests fail
- [ ] Status badges in README

#### Commit Message Template
```
ci: add GitHub Actions CI/CD pipeline

- Create test workflow for backend and frontend
- Configure PostgreSQL test database
- Run pytest for backend tests
- Run Vitest for frontend tests
- Block PRs on test failures
- Add status badges to README
```

---

### ✅ **Task 013: Enhanced Error Logging** (No dependencies)

**Finding:** Limited error logging; production issues hard to diagnose

**Risk Level:** 🟠 **MEDIUM**  
**Estimate:** 1.5 hours  
**Difficulty:** Easy  

#### Implementation: Structured Logging

```python
import logging
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Middleware for request/response logging
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(json.dumps({
        "method": request.method,
        "path": request.url.path,
        "status": response.status_code,
        "duration": process_time
    }))
    response = await call_next(request)
    return response

# Error logging
@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(json.dumps({
        "error": str(exc),
        "path": str(request.url),
        "method": request.method,
        "traceback": traceback.format_exc()
    }))
    return JSONResponse(status_code=500, content={"detail": "Internal error"})
```

#### Acceptance Criteria
- [ ] Structured JSON logging configured
- [ ] Request/response logging middleware
- [ ] Exception handlers log errors
- [ ] Database query logging (slow query logging)
- [ ] Performance metrics logged
- [ ] Logs written to file + stdout
- [ ] Log levels configurable via env

#### Commit Message Template
```
feat(logging): add comprehensive structured logging

- Configure JSON structured logging
- Add middleware for request/response logging
- Add exception handlers with stack traces
- Log slow queries (>1s)
- Environment-based log level configuration
- Logs output to file and stdout
```

---

### ✅ **Task 014: Code Review Workflow** (No dependencies)

**Finding:** No code review process; knowledge siloed

**Risk Level:** 🟠 **MEDIUM**  
**Estimate:** 1-1.5 hours  
**Difficulty:** Easy  

#### GitHub Configuration

1. **Branch Protection Rules**
   - Require pull request reviews before merge
   - Require status checks to pass
   - Require branches to be up to date
   - Require code review from OWNERS

2. **CODEOWNERS File**
```
# .github/CODEOWNERS
/production/backend/           @codex
/production/frontend/          @codex
/production/database/          @codex
```

3. **PR Template**
```markdown
# Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Database change
- [ ] Security fix

## Testing Done
- [ ] Unit tests
- [ ] Manual testing
- [ ] Integration tests

## Checklist
- [ ] Code follows style guidelines
- [ ] No hardcoded credentials
- [ ] Added/updated tests
- [ ] Updated documentation
```

#### Acceptance Criteria
- [ ] Branch protection configured on main
- [ ] Require 1 PR review
- [ ] Require passing CI/CD checks
- [ ] CODEOWNERS file created
- [ ] PR template configured
- [ ] GitHub Actions status checks required
- [ ] Documentation for PR process

#### Commit Message Template
```
docs(process): establish code review workflow

- Configure branch protection on main branch
- Require passing CI/CD checks before merge
- Create PR template for consistency
- Add CODEOWNERS for accountability
- Document pull request process
```

---

## 🎯 TASK DEPENDENCY GRAPH

```
Task 001 (.env)
├─ Task 008 (Rate Limiting)
├─ Task 009 (Email Validation)
└─ Task 010 (Connection Pooling)

Task 002 (Migration Framework) ← CRITICAL PATH
├─ Task 004 (Constraints)
├─ Task 005 (Indexes)
├─ Task 006 (Plus-One Refactor)
└─ Task 007 (Update Triggers)

Task 003 (CORS) (Independent)

Tasks 011-014 (Independent, can run in parallel)
```

---

## 📊 EFFORT ESTIMATION BY PHASE

| Phase | Tasks | Est. Hours | Critical Path |
|-------|-------|-----------|---|
| Phase 1: Critical Blockers | 001, 002, 003 | 5-6 hours | ✅ Must complete |
| Phase 2: Database Hardening | 004-007 | 6-7 hours | ✅ After Phase 1 |
| Phase 3: Backend & API | 008-010 | 3-4 hours | ✅ After Phase 1 |
| Phase 4: CI/CD & Testing | 011-014 | 7-8 hours | ⏳ Can overlap |
| **TOTAL** | **14 tasks** | **18-20 hours** | |

---

## 🚀 WEEK 2 EXECUTION STRATEGY

### Monday Morning (2 hours)
- Complete Task 001 (.env configuration) - 1.5 hours
- Complete Task 003 (CORS) - 1 hour
- **Blockers:** Verify all hardcoded credentials are gone

### Monday Afternoon (2.5 hours)
- Complete Task 002 (Migration Framework) - 2.5 hours
- **Result:** Can now run migrations

### Tuesday Morning (3 hours)
- Complete Task 004 (Constraints) - 2 hours
- Complete Task 005 (Indexes) - 1 hour
- **Verification:** Run migrations successfully

### Tuesday Afternoon (2.5 hours)
- Complete Task 006 (Plus-One Refactor) - 2 hours
- Complete Task 007 (Update Triggers) - 1 hour
- **Testing:** Verify data integrity

### Wednesday (3 hours)
- Complete Task 008 (Rate Limiting) - 1.5 hours
- Complete Task 009 (Email Validation) - 1 hour
- Complete Task 010 (Connection Pooling) - 1 hour
- **Load Test:** Verify performance improvements

### Thursday (2.5 hours)
- Complete Task 011 (Frontend Tests) - 2.5 hours
- **Coverage:** Achieve >80% on guest components

### Friday (3 hours)
- Complete Task 012 (CI/CD) - 2 hours
- Complete Task 013 (Error Logging) - 1 hour
- Complete Task 014 (Code Review Workflow) - 1 hour
- **Cleanup:** Verify all 14 tasks complete

---

## ✅ ACCEPTANCE CRITERIA (ENTIRE WEEK 2)

- [ ] All 3 critical blockers fixed (CORS, .env, migrations)
- [ ] All 7 database hardening tasks complete
- [ ] All 3 backend/API tasks complete
- [ ] At least 2 of 4 CI/CD tasks complete (011, 012)
- [ ] Zero hardcoded credentials in git
- [ ] All tests passing
- [ ] All migrations reversible
- [ ] Code review workflow documented
- [ ] No security warnings in dependency scan

---

## 🔐 SECURITY CHECKLIST (POST-WEEK-2)

Before any production deployment:

- [ ] CORS restricted to known origins (not *)
- [ ] All credentials in .env (none in code/git)
- [ ] Rate limiting enabled on all endpoints
- [ ] Email validation RFC 5322 compliant
- [ ] Database constraints prevent invalid data
- [ ] Connection pooling configured
- [ ] Update triggers working
- [ ] Indexes created for performance
- [ ] Error logging captures issues
- [ ] CI/CD blocks merge of failing code
- [ ] Code reviews required on main branch

---

## 📋 FILES TO CREATE

### Critical Path
- [ ] `.env.example` - Environment variable template
- [ ] `.env` - Local environment (add to .gitignore)
- [ ] `production/backend/alembic/env.py` - Alembic configuration
- [ ] `production/backend/alembic/versions/001_baseline_schema.py` - Initial migration
- [ ] `.github/workflows/test.yml` - CI/CD pipeline

### High Priority Database
- [ ] `production/backend/alembic/versions/002_add_constraints.py` - NOT NULLs
- [ ] `production/backend/alembic/versions/003_create_indexes.py` - Indexes
- [ ] `production/backend/alembic/versions/004_normalize_plus_one.py` - Plus-one refactor
- [ ] `production/backend/alembic/versions/005_add_triggers.py` - Update triggers

### Documentation
- [ ] `MIGRATION_GUIDE.md` - How to create migrations
- [ ] `SECURITY_CHECKLIST.md` - Pre-production verification
- [ ] `.github/CODEOWNERS` - Code ownership
- [ ] `.github/pull_request_template.md` - PR template

---

## 📚 DOCUMENTATION UPDATES

- [ ] Update README with CORS configuration
- [ ] Add environment variable documentation
- [ ] Document migration workflow
- [ ] Add security best practices guide
- [ ] Update CONTRIBUTION.md with code review process
- [ ] Add troubleshooting guide for common issues

---

## 🎯 SUCCESS CRITERIA

### By End of Week 2:
```
✅ System is production-ready (all blockers fixed)
✅ Database is properly designed (3NF, constraints, indexes)
✅ API is protected (rate limiting, CORS, auth-ready)
✅ Infrastructure is automated (CI/CD, migrations)
✅ Team process is established (code reviews, documentation)
✅ Security is hardened (no credentials in code)
✅ Ready for real data and production deployment
```

---

## 📞 BLOCKERS & ESCALATION

If blocked on any critical task:
1. Task 002 (migrations) blocks Tasks 004-007
2. Task 001 (.env) blocks Tasks 008-010
3. Task 003 (CORS) blocks all API calls from frontend

These have automatic fallbacks:
- If migration framework fails: Use raw SQL with manual tracking
- If .env fails: Create config.py with imports
- If CORS fails: Disable temporarily, use proxy

---

**Status:** Ready for Codex implementation  
**Next Step:** Begin Week 2 task execution  
**Target Date:** 2026-06-17  

---

*Plan created: 2026-06-10*  
*Review Date: TBD*  
*Approved: Pending human review*

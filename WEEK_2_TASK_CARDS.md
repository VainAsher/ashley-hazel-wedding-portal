# 📋 WEEK 2 TASK CARDS - Detailed Implementation Guide for Codex

**Format:** Individual task cards with all implementation details  
**Target:** Codex autonomous implementation with 1-2 hour task duration  
**Date:** 2026-06-10  

---

## 🔴 CRITICAL BLOCKERS (DAYS 1-2)

---

## TASK-011: Configure Environment Variables & .env

**Epic:** Security Hardening  
**Sprint:** Week 2  
**Story:** Externalize all credentials to environment configuration  
**Estimate:** 1.5-2 hours  
**Difficulty:** 🟢 Easy  
**Status:** 🔴 CRITICAL BLOCKER  
**Blocks:** Tasks 008, 009, 010  

### Description
The current codebase contains hardcoded database credentials, API configuration, and secrets. This violates security best practices and prevents safe git repository management. All credentials must be moved to environment variables loaded from `.env` file (not committed).

### Acceptance Criteria
- [ ] `.env.example` created with all required variables documented
- [ ] `.env` created in project root with valid configuration
- [ ] `.env` added to `.gitignore` (verify with `git check-ignore`)
- [ ] All hardcoded database connection strings replaced with `${DATABASE_URL}` or similar
- [ ] All API keys and secrets use environment variables
- [ ] Backend loads variables via `python-dotenv`
- [ ] Frontend loads variables via Vite `.env` files
- [ ] No credentials appear in git log (verified with `git log -S "password"`)
- [ ] Application runs with only `.env` file present
- [ ] Tests pass with environment configuration

### Implementation Notes

#### Step 1: Create `.env.example`
```env
# Database Configuration
DATABASE_URL=postgresql://wedding_dev:password@192.168.0.32:5432/wedding
DB_HOST=192.168.0.32
DB_PORT=5432
DB_USER=wedding_dev
DB_PASSWORD=change_me_in_production
DB_NAME=wedding

# Backend Server
BACKEND_HOST=0.0.0.0
BACKEND_PORT=3001
ENVIRONMENT=development

# Frontend Configuration
VITE_API_URL=http://192.168.0.32:3001
VITE_ENVIRONMENT=development
VITE_LOG_LEVEL=debug

# CORS Configuration
ALLOWED_ORIGINS=http://192.168.0.32:3000,http://localhost:3000

# Email Configuration (for future tasks)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=app_password_here

# Logging
LOG_LEVEL=INFO
LOG_FILE=/var/log/wedding-dashboard/app.log

# Security
SECRET_KEY=change_me_in_production
ALGORITHM=HS256
```

#### Step 2: Modify Backend Configuration

**File:** `production/backend/app/db/database.py` (or equivalent)

```python
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine

# Load environment variables
load_dotenv()

# Get database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://wedding_dev:password@localhost:5432/wedding"
)

# Create engine with URL
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

**File:** `production/backend/app/main.py` (or FastAPI app initialization)

```python
import os
from fastapi import FastAPI
from dotenv import load_dotenv

# Load environment variables at startup
load_dotenv()

app = FastAPI(title="Wedding Dashboard API")

# CORS configuration from environment
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://192.168.0.32:3000,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Other configuration
@app.on_event("startup")
async def startup_event():
    environment = os.getenv("ENVIRONMENT", "development")
    print(f"Starting in {environment} mode")
```

#### Step 3: Modify Frontend Configuration

**File:** `production/frontend/.env.example`
```env
VITE_API_URL=http://192.168.0.32:3001
VITE_ENVIRONMENT=development
VITE_LOG_LEVEL=debug
```

**File:** `production/frontend/src/api.ts` (or API configuration)

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export async function fetchGuests() {
  const response = await fetch(`${API_URL}/api/guests`)
  return response.json()
}
```

#### Step 4: Update .gitignore

**File:** `.gitignore`

```
# Environment variables - NEVER commit
.env
.env.local
.env.*.local

# Keep .env.example in git for reference
!.env.example

# Other ignores (add to existing)
__pycache__/
*.pyc
node_modules/
dist/
venv/
```

#### Step 5: Dependency Installation

**Backend:**
```bash
pip install python-dotenv
```

**Frontend:**
No additional dependencies needed - Vite has built-in `.env` support.

### Testing Strategy

#### Verify no credentials in git history
```bash
# Search for common credential patterns
git log --all -S "password=" --source --oneline
git log --all -S "192.168.0.32:5432" --source --oneline
git log --all -S "postgresql://" --source --oneline

# Expected: No results (empty output)
```

#### Verify .env is ignored
```bash
git check-ignore .env
# Expected: .env (if git shows it, .env is properly ignored)
```

#### Test backend loads from .env
```bash
cd production/backend

# Create test .env
cat > .env << EOF
DATABASE_URL=postgresql://wedding_dev:password@192.168.0.32:5432/wedding
BACKEND_PORT=3001
ENVIRONMENT=development
EOF

# Test application starts
python -m pytest tests/ -v
# All tests should pass with .env configuration
```

#### Test frontend loads from .env
```bash
cd production/frontend

# Create test .env
cat > .env << EOF
VITE_API_URL=http://192.168.0.32:3001
VITE_ENVIRONMENT=development
EOF

# Test build uses environment
npm run build
# Check that API URL is baked into dist/
grep "192.168.0.32:3001" dist/assets/*.js
```

### Files to Create/Modify

| File | Action | Type |
|------|--------|------|
| `.env.example` | Create | Config |
| `.env` | Create | Config (local only) |
| `.gitignore` | Modify | Git config |
| `production/backend/app/db/database.py` | Modify | Backend code |
| `production/backend/app/main.py` | Modify | Backend code |
| `production/frontend/.env.example` | Create | Config |
| `production/frontend/src/api.ts` | Modify | Frontend code |

### Branch & Commit

```bash
git checkout -b feature/config-environment-variables
# ... implement changes ...
git add .env.example .gitignore production/
git commit -m "feat(config): externalize credentials to environment variables

- Create .env.example with all required configuration
- Load environment variables in backend via python-dotenv
- Load environment variables in frontend via Vite
- Remove all hardcoded credentials from source code
- Add .env to .gitignore to prevent accidental commits
- Document all required environment variables
- Verify no secrets remain in git history"
```

### PR Description Template

```markdown
## Summary
Externalize all hardcoded credentials to environment variables for secure configuration management. Prevents accidental credential leaks in git repository.

## Changes
- Created `.env.example` with all required configuration variables
- Modified backend database connection to use `DATABASE_URL` env var
- Modified frontend API client to use `VITE_API_URL` env var
- Added `.env` to `.gitignore` to prevent commits
- Installed `python-dotenv` for backend env var loading

## Testing Done
- Verified no credentials in git log (`git log -S "password"`)
- Verified `.env` is properly gitignored
- Backend tests pass with `.env` configuration
- Frontend build uses `VITE_API_URL` correctly
- Application starts and connects to database with env vars only

## Security Verification
- [ ] No hardcoded database URLs in code
- [ ] No hardcoded API keys in code
- [ ] No hardcoded credentials in git history
- [ ] `.env` properly ignored by git
- [ ] `.env.example` provides safe template
```

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Module not found: python-dotenv" | Package not installed | `pip install python-dotenv` |
| `.env` appears in git | Not in `.gitignore` | Add `.env` to `.gitignore` and run `git rm --cached .env` |
| Frontend API calls fail | `VITE_API_URL` not set | Ensure `.env` exists in `production/frontend/` |
| Database connection fails | `DATABASE_URL` malformed | Check format: `postgresql://user:pass@host:port/db` |

### Rollback Plan

If configuration needs to revert:
```bash
git revert [commit-hash]
# OR manually restore hardcoded values (not recommended)
```

---

## TASK-012: Implement CORS Security Configuration

**Epic:** Security Hardening  
**Sprint:** Week 2  
**Story:** Replace overpermissive CORS with explicit origin whitelist  
**Estimate:** 1-1.5 hours  
**Difficulty:** 🟢 Easy  
**Status:** 🔴 CRITICAL BLOCKER  
**Blocks:** Frontend-backend integration  
**Dependencies:** Task 011 (.env configuration)

### Description
The current CORS configuration uses `allow_origins=["*"]` which accepts requests from ANY domain. This is a security vulnerability that allows any website to access your API. Must be replaced with explicit whitelist of known origins.

### Background: CORS Security
- **Current:** `allow_origins=["*"]` accepts requests from any domain
- **Problem:** Malicious websites can make requests to API and steal data
- **Solution:** Explicit whitelist: only `http://192.168.0.32:3000` and `http://localhost:3000`
- **Production:** Add production domain only

### Acceptance Criteria
- [ ] Wildcard CORS removed from code
- [ ] Only explicit origins allowed (from environment variable)
- [ ] CORS configuration environment-based
- [ ] Credentials handling configured (`allow_credentials=True`)
- [ ] Options requests handled properly (preflight)
- [ ] CORS headers returned in responses
- [ ] Requests from unauthorized origins rejected (no CORS headers)
- [ ] Tested with curl/Postman/browser
- [ ] Documentation updated with CORS explanation

### Implementation Notes

#### Current Problem (Find & Review)
```python
# DO NOT KEEP THIS - SECURITY VULNERABILITY
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ❌ INSECURE - allows any domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### Correct Implementation

**File:** `production/backend/app/main.py`

```python
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Wedding Dashboard API")

# Get allowed origins from environment
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://192.168.0.32:3000,http://localhost:3000"
).split(",")

# Strip whitespace from each origin
ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS]

# Configure CORS with explicit origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # ✅ Explicit whitelist
    allow_credentials=True,          # ✅ Allow cookies/auth headers
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=600,                     # ✅ Cache preflight for 10 minutes
)

@app.on_event("startup")
async def startup():
    print(f"CORS enabled for origins: {ALLOWED_ORIGINS}")
```

#### Environment Configuration

**File:** `.env`
```env
ALLOWED_ORIGINS=http://192.168.0.32:3000,http://localhost:3000
```

**For Production:**
```env
ALLOWED_ORIGINS=https://ashley-hazel-wedding.com
```

### Testing Strategy

#### Test 1: Allowed Origin (Should work)
```bash
# From allowed origin (should succeed)
curl -i \
  -H "Origin: http://192.168.0.32:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  http://192.168.0.32:3001/api/guests

# Expected response headers:
# Access-Control-Allow-Origin: http://192.168.0.32:3000
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# Access-Control-Allow-Headers: Content-Type, Authorization
```

#### Test 2: Blocked Origin (Should fail)
```bash
# From unauthorized origin (should fail)
curl -i \
  -H "Origin: http://malicious.com" \
  -H "Access-Control-Request-Method: POST" \
  http://192.168.0.32:3001/api/guests

# Expected: NO Access-Control-Allow-Origin header
# Browser will block the response
```

#### Test 3: Browser Console Test
Open browser console on `http://192.168.0.32:3000`:
```javascript
// This should work (same origin as ALLOWED_ORIGINS)
fetch('http://192.168.0.32:3001/api/guests')
  .then(r => r.json())
  .then(data => console.log('Success:', data))
  .catch(err => console.error('Error:', err))
```

Change origin to test malicious domain:
```javascript
// This would fail in browser (CORS blocked)
// Even if script runs, browser prevents access
```

#### Test 4: POST with Credentials
```bash
# Test credentials are allowed
curl -i -X POST \
  -H "Origin: http://192.168.0.32:3000" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=abc123" \
  -d '{"name":"John"}' \
  http://192.168.0.32:3001/api/guests

# Expected: Access-Control-Allow-Credentials: true
```

### Files to Create/Modify

| File | Action | Details |
|------|--------|---------|
| `production/backend/app/main.py` | Modify | Replace wildcard with env-based origins |
| `.env` | Modify | Add `ALLOWED_ORIGINS` variable |
| `.env.example` | Modify | Add `ALLOWED_ORIGINS` example |

### Verification Checklist

Before submitting PR:
```bash
# 1. Search for remaining wildcard CORS
grep -r "allow_origins=\[\"*\"\]" production/backend/

# Expected: No results

# 2. Verify CORS uses environment variable
grep -A 5 "CORSMiddleware" production/backend/app/main.py
# Should show: allow_origins=ALLOWED_ORIGINS

# 3. Test with curl
curl -H "Origin: http://192.168.0.32:3000" \
  http://192.168.0.32:3001/api/guests -i
# Should have Access-Control-Allow-Origin header

# 4. Verify credentials configured
grep "allow_credentials" production/backend/app/main.py
# Should show: allow_credentials=True
```

### Branch & Commit

```bash
git checkout -b fix/cors-security-configuration
# ... implement changes ...
git add production/backend/ .env .env.example
git commit -m "fix(security): restrict CORS to explicit origin whitelist

- Replace wildcard allow_origins=[\*] with explicit whitelist
- Configure CORS origins from ALLOWED_ORIGINS environment variable
- Add proper credentials handling (allow_credentials=True)
- Document allowed origins for development and production
- Verify no requests from unauthorized origins accepted"
```

### PR Description

```markdown
## Security Fix: CORS Configuration

## Problem
Current CORS configuration uses `allow_origins=["*"]` which accepts requests from ANY domain. This allows malicious websites to make API calls and potentially steal data.

## Solution
Replace wildcard with explicit whitelist of known origins (from environment variable).

### Before
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ❌ INSECURE
)
```

### After
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # ✅ Explicit whitelist
)
```

## Testing
- [x] Allowed origins (http://192.168.0.32:3000) - requests succeed
- [x] Unauthorized origins (http://malicious.com) - requests blocked
- [x] Preflight OPTIONS requests work
- [x] POST with credentials work
- [x] Environment variable configuration works

## Verification
- [x] No wildcard CORS remaining
- [x] All origins from environment variable
- [x] Credentials properly configured
```

---

## TASK-013: Set Up Database Migration Framework (Alembic)

**Epic:** Database Infrastructure  
**Sprint:** Week 2  
**Story:** Implement version-controlled database schema management with Alembic  
**Estimate:** 2-2.5 hours  
**Difficulty:** 🟡 Medium  
**Status:** 🔴 CRITICAL BLOCKER  
**Blocks:** Tasks 004, 005, 006, 007 (all database changes)  
**Dependencies:** Task 011 (.env configuration)

### Description
There's currently no migration framework. The database schema exists but there's no way to:
- Track schema changes in git
- Deploy schema to new environments
- Rollback problematic changes
- Manage schema evolution with code reviews

This task implements Alembic (Python/SQLAlchemy standard) for production-quality migrations.

### Why Alembic?
- **Standard:** Industry standard for Python/SQLAlchemy projects
- **Safe:** Can auto-generate migrations and review before applying
- **Reversible:** Each migration has upgrade/downgrade
- **Tracked:** All changes in git with full history
- **Tested:** Proven in production systems

### What Gets Created
```
production/backend/
├── alembic/
│   ├── versions/
│   │   └── 001_baseline_schema.py    ← Baseline migration
│   ├── env.py                         ← Alembic runtime config
│   ├── script.py.mako                 ← Migration template
│   └── README
├── alembic.ini                        ← Alembic configuration
└── requirements.txt                   ← Add alembic dependency
```

### Acceptance Criteria
- [ ] Alembic installed and initialized
- [ ] `alembic init production/backend/alembic` succeeds
- [ ] Alembic configured to use SQLAlchemy models
- [ ] Baseline migration created capturing current schema
- [ ] `alembic upgrade head` applies baseline successfully
- [ ] `alembic downgrade base` removes all tables
- [ ] `alembic upgrade head` re-creates schema
- [ ] Migration history in git (`git log`)
- [ ] Documentation for creating new migrations
- [ ] Tests verify migrations work on clean database

### Step-by-Step Implementation

#### Step 1: Install Alembic

```bash
cd production/backend

# Install alembic
pip install alembic

# Add to requirements.txt
echo "alembic>=1.11.0" >> requirements.txt
```

#### Step 2: Initialize Alembic

```bash
# Create alembic directory structure
alembic init alembic

# Result:
# alembic/
# ├── versions/          ← Migration files go here
# ├── env.py             ← Runtime configuration
# ├── script.py.mako     ← Template for new migrations
# └── README
```

#### Step 3: Configure Alembic

**File:** `production/backend/alembic/env.py`

Modify to use SQLAlchemy models:

```python
import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import your models
from app.db.models import Base

# Get configuration
config = context.config

# Configure database URL
sqlalchemy_url = os.getenv(
    "DATABASE_URL",
    "postgresql://wedding_dev:password@localhost:5432/wedding"
)
config.set_main_option("sqlalchemy.url", sqlalchemy_url)

# Configure logging
fileConfig(config.config_file_name)

# Target metadata from models
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**File:** `production/backend/alembic.ini`

Verify these settings:

```ini
# Location of migration files
script_location = alembic

# SQLAlchemy configuration
sqlalchemy.url = postgresql://wedding_dev:password@localhost:5432/wedding

# Log configuration
log_file = alembic.log
log_level = INFO
```

#### Step 4: Create Baseline Migration

This migration captures the current database schema.

**Command:**
```bash
cd production/backend

# Create baseline migration
alembic revision --autogenerate -m "baseline: initial schema"

# This creates: alembic/versions/001_baseline_initial_schema.py
```

The generated file should look like:

**File:** `production/backend/alembic/versions/001_baseline_initial_schema.py`

```python
"""baseline: initial schema"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Apply initial schema."""
    # Create enums
    rsvp_status = postgresql.ENUM('pending', 'accepted', 'declined', 'tentative', name='rsvp_status')
    rsvp_status.create(op.get_bind(), checkfirst=True)
    
    task_status = postgresql.ENUM('not_started', 'in_progress', 'completed', 'blocked', name='task_status')
    task_status.create(op.get_bind(), checkfirst=True)
    
    # Create tables
    op.create_table(
        'weddings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('couple_names', sa.String(255), nullable=False),
        sa.Column('wedding_date', sa.Date(), nullable=False),
        # ... rest of columns
        sa.PrimaryKeyConstraint('id')
    )
    
    # ... more tables
    
    # Create foreign keys
    op.create_foreign_key('fk_guests_wedding_id', 'guests', 'weddings', ['wedding_id'], ['id'])
    # ... more foreign keys


def downgrade() -> None:
    """Revert initial schema."""
    # Drop in reverse order of creation
    op.drop_table('guests')
    op.drop_table('wedding_party')
    op.drop_table('vendors')
    # ... more drops
    op.drop_table('weddings')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS rsvp_status')
    op.execute('DROP TYPE IF EXISTS task_status')
```

#### Step 5: Test Migrations

```bash
cd production/backend

# Apply all migrations (should work on fresh DB)
alembic upgrade head

# Verify schema created
PGPASSWORD='wedding_dev_2026' psql -h localhost -u wedding_dev -d wedding -c "\dt"
# Expected: All tables present

# Test downgrade
alembic downgrade base

# Verify schema removed
PGPASSWORD='wedding_dev_2026' psql -h localhost -u wedding_dev -d wedding -c "\dt"
# Expected: No tables

# Test upgrade again
alembic upgrade head

# Verify schema recreated
PGPASSWORD='wedding_dev_2026' psql -h localhost -u wedding_dev -d wedding -c "\dt"
# Expected: All tables present again
```

### Documentation: Creating Future Migrations

**File:** `MIGRATION_GUIDE.md`

```markdown
# Database Migration Guide

## Creating a New Migration

### 1. Make model changes in `app/db/models.py`

```python
class Guest(Base):
    __tablename__ = "guests"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    email: Mapped[str] = mapped_column(unique=True)  # New field
```

### 2. Generate migration (auto-generated from models)

```bash
cd production/backend
alembic revision --autogenerate -m "add email field to guests"
```

### 3. Review generated migration

Edit `alembic/versions/002_add_email_field_to_guests.py` and verify changes.

### 4. Test migration

```bash
# Apply migration
alembic upgrade head

# Rollback to test downgrade
alembic downgrade -1

# Verify downgrade worked
alembic current

# Re-apply
alembic upgrade head
```

### 5. Commit to git

```bash
git add alembic/versions/
git commit -m "feat(database): add email field to guests"
```

## Viewing Migration History

```bash
# Show all applied migrations
alembic current

# Show pending migrations
alembic heads

# View full history
alembic history
```

## Downgrading

```bash
# Downgrade one migration
alembic downgrade -1

# Downgrade to specific migration
alembic downgrade 001
```

## Troubleshooting

### "Can't locate revision identified by 'xyz'"
- Ensure migration file exists in `alembic/versions/`
- Check revision ID in file matches

### "Foreign key constraint failed"
- Drop migrations in correct order (respect FKs)
- Check `downgrade()` drops in reverse order

### "Table already exists"
- Fresh database may already have schema
- Reset: `alembic downgrade base` then `alembic upgrade head`
```

### Testing Strategy

#### Test 1: Baseline Migration Works
```bash
cd production/backend

# Start with clean database
alembic downgrade base
# Wait for it to complete

# Apply baseline
alembic upgrade head

# Verify schema
psql -h localhost -u wedding_dev -d wedding -c "\dt"
# Should show all 11 tables
```

#### Test 2: Rollback Works
```bash
# Downgrade to base
alembic downgrade base

# Verify tables removed
psql -h localhost -u wedding_dev -d wedding -c "\dt"
# Should show no tables

# Re-upgrade
alembic upgrade head

# Verify tables back
psql -h localhost -u wedding_dev -d wedding -c "\dt"
```

#### Test 3: Migration in CI
```bash
# Test migrations run in test database
pytest production/backend/tests/test_migrations.py -v
```

**File:** `production/backend/tests/test_migrations.py`

```python
import subprocess
import os
import pytest


def test_baseline_migration():
    """Test baseline migration applies successfully."""
    # Start fresh
    result = subprocess.run(
        ["alembic", "downgrade", "base"],
        cwd="production/backend",
        capture_output=True
    )
    assert result.returncode == 0, f"Downgrade failed: {result.stderr}"
    
    # Apply baseline
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd="production/backend",
        capture_output=True
    )
    assert result.returncode == 0, f"Upgrade failed: {result.stderr}"


def test_migration_rollback():
    """Test migrations can be rolled back."""
    # Downgrade
    result = subprocess.run(
        ["alembic", "downgrade", "-1"],
        cwd="production/backend",
        capture_output=True
    )
    assert result.returncode == 0

    # Re-upgrade
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd="production/backend",
        capture_output=True
    )
    assert result.returncode == 0
```

### Files to Create

| File | Purpose |
|------|---------|
| `production/backend/alembic/__init__.py` | Package marker |
| `production/backend/alembic/env.py` | Runtime configuration |
| `production/backend/alembic/script.py.mako` | Migration template |
| `production/backend/alembic.ini` | Alembic settings |
| `production/backend/alembic/versions/001_baseline_initial_schema.py` | Baseline migration |
| `MIGRATION_GUIDE.md` | Documentation |
| `production/backend/tests/test_migrations.py` | Migration tests |

### Branch & Commit

```bash
git checkout -b feat/database-migration-framework

# ... implement alembic ...

git add production/backend/alembic/ \
        production/backend/alembic.ini \
        MIGRATION_GUIDE.md \
        production/backend/requirements.txt \
        production/backend/tests/test_migrations.py

git commit -m "feat(database): implement Alembic migration framework

- Initialize Alembic with SQLAlchemy configuration
- Create baseline migration capturing current schema
- Configure auto-migration generation from models
- Add migration testing to test suite
- Document migration workflow and conventions
- Enable version-controlled schema changes"
```

### PR Description

```markdown
## Database Migrations with Alembic

## Problem
No mechanism to track and manage database schema changes. Schema exists but:
- No version control for schema
- No way to deploy to new environments
- No rollback capability
- No code review for schema changes

## Solution
Implement Alembic (Python/SQLAlchemy standard) for production-quality migrations.

## What's Created
- `alembic/` directory with migration framework
- Baseline migration capturing current schema
- Migration testing in pytest
- Documentation for creating future migrations

## Testing Done
- [x] Baseline migration applies cleanly
- [x] Downgrade removes all tables
- [x] Upgrade recreates schema identically
- [x] Migration history in git
- [x] Tests verify migrations work

## Next Steps
Once merged, future schema changes use:
1. Modify model in `app/db/models.py`
2. Generate migration: `alembic revision --autogenerate -m "description"`
3. Review and test migration
4. Commit to git
5. Deploy: `alembic upgrade head`
```

---

## 🟡 HIGH PRIORITY ITEMS (DAYS 2-4)

[Continuing with remaining 11 tasks in similar detail...]

Due to token limits, I'll provide a summary structure for the remaining tasks. Create individual task cards following the same template above for:

### Database Hardening Tasks (004-007)
- Task 004: Add NOT NULL Constraints
- Task 005: Create Database Indexes
- Task 006: Refactor Plus-One Schema
- Task 007: Add Update Triggers

### Backend/API Tasks (008-010)
- Task 008: Rate Limiting Implementation
- Task 009: Email Validation Enhancement
- Task 010: Connection Pooling Setup

### Infrastructure Tasks (011-014)
- Task 011: Frontend Unit Tests
- Task 012: CI/CD Pipeline (GitHub Actions)
- Task 013: Error Logging Enhancement
- Task 014: Code Review Workflow

---

## 📊 QUICK REFERENCE TABLE

| Task # | Title | Est. Hours | Difficulty | Blocks | Status |
|--------|-------|-----------|-----------|--------|--------|
| 011 | Environment Variables | 1.5-2 | 🟢 Easy | 008-010 | 🔴 CRITICAL |
| 012 | CORS Configuration | 1-1.5 | 🟢 Easy | Backend calls | 🔴 CRITICAL |
| 013 | Migration Framework | 2-2.5 | 🟡 Medium | 004-007 | 🔴 CRITICAL |
| 004 | NOT NULL Constraints | 2 | 🟡 Medium | - | 🟡 HIGH |
| 005 | Create Indexes | 1.5 | 🟡 Medium | - | 🟡 HIGH |
| 006 | Plus-One Refactor | 2 | 🟡 Medium | - | 🟡 HIGH |
| 007 | Update Triggers | 1 | 🟢 Easy | - | 🟡 HIGH |
| 008 | Rate Limiting | 1.5 | 🟡 Medium | 011 | 🟡 HIGH |
| 009 | Email Validation | 1 | 🟢 Easy | 011 | 🟡 HIGH |
| 010 | Connection Pooling | 1 | 🟢 Easy | 011 | 🟡 HIGH |
| 011 | Frontend Tests | 2.5 | 🟡 Medium | - | 🟠 MEDIUM |
| 012 | CI/CD Pipeline | 2-2.5 | 🟡 Medium | - | 🟠 MEDIUM |
| 013 | Error Logging | 1.5 | 🟢 Easy | - | 🟠 MEDIUM |
| 014 | Code Review WF | 1-1.5 | 🟢 Easy | - | 🟠 MEDIUM |

---

## 🎯 EXECUTION ORDER (RECOMMENDED)

**Monday:** Tasks 011, 012, 013 (complete by EOD)
**Tuesday:** Tasks 004, 005, 006, 007 (database hardening)
**Wednesday:** Tasks 008, 009, 010 (backend enhancements)
**Thursday:** Tasks 011-014 (CI/CD and automation)
**Friday:** Testing, validation, documentation

---

**Created:** 2026-06-10  
**For:** Codex autonomous implementation  
**Format:** Task cards ready for 1-2 hour focused sprints  
**Status:** Ready for execution

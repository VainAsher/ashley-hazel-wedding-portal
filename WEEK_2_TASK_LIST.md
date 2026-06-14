# 📋 Week 2 Task List - Infrastructure & Security Hardening

**Created:** 2026-06-10  
**Total Tasks:** 15  
**Total Estimated Time:** 25-30 hours  
**Timeline:** Monday through Friday  
**Focus Areas:** Security, Infrastructure, Testing, Monitoring

---

## Task Overview

### Category 1: Critical Security Fixes (Tasks 001-003)
These block production deployment. Complete first.

| Task | Name | Est. | Priority |
|------|------|-----|----------|
| 001 | Fix CORS Misconfiguration | 90 min | 🔴 CRITICAL |
| 002 | Externalize Environment Variables | 60 min | 🔴 CRITICAL |
| 003 | Credential Rotation & Secrets | 75 min | 🔴 CRITICAL |

### Category 2: Database Optimization (Tasks 004-006)
Required for production performance. Complete second.

| Task | Name | Est. | Priority |
|------|------|-----|----------|
| 004 | Add Database Indexes | 90 min | 🟠 HIGH |
| 005 | Add Constraints & Validation | 75 min | 🟠 HIGH |
| 006 | Create Audit Triggers | 75 min | 🟠 HIGH |

### Category 3: CI/CD Pipeline Setup (Tasks 007-009)
Required for reliable deployment. Complete third.

| Task | Name | Est. | Priority |
|------|------|-----|----------|
| 007 | Setup GitHub Actions Tests | 120 min | 🟠 HIGH |
| 008 | Configure Automated Deployment | 90 min | 🟠 HIGH |
| 009 | Environment-Specific Config | 75 min | 🟠 HIGH |

### Category 4: Testing Infrastructure (Tasks 010-012)
Required for code quality. Complete fourth.

| Task | Name | Est. | Priority |
|------|------|-----|----------|
| 010 | Backend Test Fixtures | 75 min | 🟡 MEDIUM |
| 011 | Integration Test Patterns | 90 min | 🟡 MEDIUM |
| 012 | E2E Test Automation | 120 min | 🟡 MEDIUM |

### Category 5: Monitoring & Logging (Tasks 013-015)
Required for production visibility. Complete fifth.

| Task | Name | Est. | Priority |
|------|------|-----|----------|
| 013 | Application Logging Framework | 75 min | 🟡 MEDIUM |
| 014 | Error Tracking Integration | 60 min | 🟡 MEDIUM |
| 015 | Performance Monitoring | 75 min | 🟡 MEDIUM |

---

## CATEGORY 1: CRITICAL SECURITY FIXES

---

## TASK-001: Fix CORS Misconfiguration

**Epic:** Week 2  
**Story:** Security Fixes  
**Estimate:** 90 minutes  
**Difficulty:** Medium  
**Priority:** CRITICAL 🔴

### Description

Current CORS configuration is too permissive (`allow_origins=["*"]`), which allows any website to make requests to our API. This is a security vulnerability.

**What needs to be done:**
1. Update CORS configuration to restrict to legitimate origins
2. Make origins configurable by environment (dev/staging/prod)
3. Add security headers to all responses
4. Test that legitimate requests work
5. Test that illegitimate requests are blocked

### Acceptance Criteria

- [ ] CORS origins restricted to specific domains
- [ ] Different origins for dev/staging/prod
- [ ] Security headers added (X-Content-Type-Options, X-Frame-Options, etc.)
- [ ] Curl tests verify proper CORS behavior
- [ ] HTTP preflight requests handled correctly
- [ ] Code follows existing patterns
- [ ] All tests passing
- [ ] PR description explains security rationale

### Implementation Notes

**Files to Modify:**
- `production/backend/app/main.py` - Update CORS middleware
- `production/backend/app/config.py` - Add to Settings class
- `production/backend/.env` - Add CORS_ORIGINS setting (dev only)
- `production/backend/.env.example` - Template for configuration

**Current Code (Insecure):**
```python
# ❌ INSECURE: In production/backend/app/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 🚨 SECURITY ISSUE
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**New Code (Secure):**
```python
# ✅ SECURE: CORS restricted by environment

from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

# Define origins based on environment
CORS_ORIGINS = settings.get_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=3600,  # Cache preflight for 1 hour
)

# Add security headers middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if settings.environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
```

**In config.py:**
```python
from enum import Enum

class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

class Settings(BaseSettings):
    environment: Environment = Environment.DEVELOPMENT
    cors_origins_raw: str = "http://localhost:3000,http://localhost:5173"
    
    def get_cors_origins(self) -> list:
        if self.environment == Environment.PRODUCTION:
            return ["https://wedding.example.com"]
        elif self.environment == Environment.STAGING:
            return [
                "https://staging.wedding.example.com",
                "http://localhost:3000",
                "http://localhost:5173"
            ]
        else:
            return self.cors_origins_raw.split(",")
```

### Success Indicators

- [ ] Task can be completed in 90 minutes
- [ ] Code follows existing patterns
- [ ] Security headers tested with curl
- [ ] CORS preflight requests work
- [ ] Tests include CORS validation
- [ ] No hardcoded values in code
- [ ] Configuration documentation clear
- [ ] Ready for security review

### Testing Strategy

**Manual Testing:**
```bash
# Test legitimate origin (should work)
curl -i -X OPTIONS http://localhost:3001/api/guests \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET"
# Should return: Access-Control-Allow-Origin: http://localhost:3000

# Test illegitimate origin (should be blocked)
curl -i -X OPTIONS http://localhost:3001/api/guests \
  -H "Origin: http://attacker.com" \
  -H "Access-Control-Request-Method: GET"
# Should NOT return Access-Control-Allow-Origin header

# Test security headers
curl -I http://localhost:3001/api/guests
# Should include:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
```

**Automated Tests:**
```python
# production/backend/tests/test_security_cors.py
def test_cors_allows_localhost_in_dev(client):
    response = client.options(
        "/api/guests",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:3000"

def test_cors_blocks_external_domain(client):
    response = client.options(
        "/api/guests",
        headers={
            "Origin": "http://attacker.com",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert "Access-Control-Allow-Origin" not in response.headers

def test_security_headers_present(client):
    response = client.get("/api/guests")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
```

### Blockers/Dependencies

- None (this is foundational)

### Related Tasks

- Previous: None (first security task)
- Next: TASK-002 (Environment variables)
- Depends on: None

---

## TASK-002: Externalize Environment Variables

**Epic:** Week 2  
**Story:** Security Fixes  
**Estimate:** 60 minutes  
**Difficulty:** Easy  
**Priority:** CRITICAL 🔴

### Description

Currently, database credentials and configuration are hardcoded or passed inline. This is a security risk. All configuration should be externalized via environment variables.

**What needs to be done:**
1. Create `.env` file template (`.env.example`)
2. Update `config.py` to read from environment variables
3. Remove hardcoded values from code
4. Ensure `.env` is in `.gitignore` (never committed)
5. Document how to set up development environment
6. Verify both local and Docker environments work

### Acceptance Criteria

- [ ] All configuration externalized to environment variables
- [ ] `.env.example` created with template
- [ ] `.env` added to `.gitignore` (never committed)
- [ ] No hardcoded credentials anywhere in codebase
- [ ] Settings validated at startup (fail fast)
- [ ] Both dev and production configs work
- [ ] Documentation updated
- [ ] Tests passing

### Implementation Notes

**Files to Create/Modify:**
- `production/backend/.env.example` - CREATE
- `production/backend/app/config.py` - Enhance Settings class
- `production/backend/.gitignore` - Add .env
- `production/backend/main.py` - Use config for all settings

**Environment Variables Needed:**
```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/wedding

# API Keys (if any)
API_KEY_SECRET=sk-xxx

# Secrets
JWT_SECRET=your-secret-key-here

# Settings
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Database Pool
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
```

**Config Code Example:**
```python
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    database_url: str
    db_pool_size: int = 10
    db_max_overflow: int = 20
    
    # Security
    jwt_secret: str
    api_key_secret: str
    
    # Application
    environment: str = "development"
    debug: bool = False
    
    # CORS
    cors_origins_raw: str = "http://localhost:3000"
    
    class Config:
        env_file = ".env"  # Load from .env file
        env_file_encoding = "utf-8"
        case_sensitive = False  # Allow both DATABASE_URL and database_url
    
    @property
    def cors_origins(self) -> list:
        return self.cors_origins_raw.split(",")

# Usage in app
from app.config import settings

print(f"Connecting to {settings.database_url}")  # ✅ Loaded from env
print(f"Environment: {settings.environment}")
```

### Success Indicators

- [ ] All credentials externalized
- [ ] `.env` never committed
- [ ] `.env.example` comprehensive
- [ ] Settings validated at startup
- [ ] Both dev and prod work
- [ ] No print statements with secrets
- [ ] Tests passing
- [ ] Documentation clear

### Testing Strategy

```bash
# Test 1: Verify .env is in .gitignore
git check-ignore .env
# Should output: .env (not in git)

# Test 2: Verify no hardcoded secrets in code
grep -r "postgresql://" production/backend --include="*.py" | grep -v ".env.example" | grep -v "test_"
# Should find nothing (only in config, not hardcoded)

# Test 3: Verify app starts with valid .env
cp production/backend/.env.example production/backend/.env
cd production/backend
source venv/bin/activate
python -c "from app.config import settings; print(f'DB: {settings.database_url}')"
# Should print database URL without error

# Test 4: Verify app fails with missing .env
rm production/backend/.env
python -c "from app.config import settings" 2>&1 | grep "DATABASE_URL"
# Should fail with error about missing DATABASE_URL
```

### Blockers/Dependencies

- Requires knowledge of environment variables
- Database must be running for full test

### Related Tasks

- Previous: TASK-001 (CORS)
- Next: TASK-003 (Credential rotation)
- Depends on: None

---

## TASK-003: Credential Rotation & Secrets Management

**Epic:** Week 2  
**Story:** Security Fixes  
**Estimate:** 75 minutes  
**Difficulty:** Medium  
**Priority:** CRITICAL 🔴

### Description

Database password and API secrets should not be visible in logs or error messages. Implement proper secret handling and rotation.

**What needs to be done:**
1. Ensure secrets are not logged or printed anywhere
2. Create secret management helpers
3. Implement password change mechanism
4. Document credential rotation procedure
5. Test that secrets are hidden in error messages
6. Add security checklist to deployment

### Acceptance Criteria

- [ ] Secrets not logged in any format
- [ ] Secret masking in error messages
- [ ] Password change procedure documented
- [ ] No secrets in git history (check git log)
- [ ] Rotation mechanism works
- [ ] Tests verify secrets are hidden
- [ ] Production deployment checklist includes credential review
- [ ] Security audit pass

### Implementation Notes

**Files to Create/Modify:**
- `production/backend/app/utils/secrets.py` - CREATE
- `production/backend/app/config.py` - Use secrets utilities
- `production/backend/app/logging.py` - Mask secrets in logs
- `production/backend/docs/SECURITY.md` - CREATE

**Secret Masking Code:**
```python
# production/backend/app/utils/secrets.py
import re

class SecretMasker:
    """Mask sensitive information in strings."""
    
    PATTERNS = {
        'database_url': r'(postgresql://\w+:)\w+(@)',  # postgres://user:XXXXX@
        'api_key': r'(sk-)\w+',  # sk-XXXXX
        'jwt': r'(eyJ\w{2,}\.)[^"]*',  # JWT token
    }
    
    @classmethod
    def mask(cls, text: str) -> str:
        """Mask all secrets in text."""
        masked = text
        for pattern in cls.PATTERNS.values():
            masked = re.sub(pattern, r'\1***REDACTED***', masked)
        return masked

# Usage in logging:
import logging

logger = logging.getLogger(__name__)

def create_guest(email: str, db: Session):
    try:
        guest = Guest(email=email)
        db.add(guest)
        db.commit()
        logger.info(f"Guest created: {email}")  # ✅ Safe
    except Exception as e:
        # ✅ Error message has secrets masked
        error_msg = SecretMasker.mask(str(e))
        logger.error(f"Failed to create guest: {error_msg}")
        raise

# Usage in error responses:
@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    # ✅ Don't expose internal error details that might contain secrets
    masked_msg = SecretMasker.mask(str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}  # Don't expose masked details either!
    )
```

**Password Rotation Procedure:**
```bash
# SECURITY.md

## Credential Rotation Procedure

### Database Password Rotation

1. Generate new password
   ```bash
   openssl rand -base64 32
   ```

2. Update database user password
   ```sql
   ALTER USER wedding_user WITH PASSWORD 'new-password-here';
   ```

3. Update environment variable
   ```bash
   # In .env or production environment
   DATABASE_URL=postgresql://wedding_user:new-password-here@host:5432/wedding
   ```

4. Restart application
   ```bash
   docker restart wedding-backend
   ```

5. Verify connection works
   ```bash
   psql $DATABASE_URL -c "SELECT version();"
   ```

6. Remove old password (30 days later if needed for rollback)

### API Key Rotation

1. Generate new key
2. Update environment variable
3. Restart application
4. Remove old key from valid keys list
5. Verify requests with new key work

### JWT Secret Rotation

⚠️ Note: Changing JWT_SECRET invalidates all existing tokens
Only do this in emergency or during planned maintenance.
```

**Security Audit Checklist:**
```markdown
## Deployment Security Checklist

Before deploying to production:

- [ ] No secrets in code (grep for passwords)
- [ ] All config externalized to environment
- [ ] `.env` file not in git
- [ ] CORS origins correct for environment
- [ ] Security headers configured
- [ ] Database has strong password (20+ chars, mixed case, numbers)
- [ ] JWT secret is unique and strong
- [ ] All tests passing
- [ ] Secrets not logged anywhere
- [ ] Error messages don't expose internals
- [ ] Rate limiting configured
- [ ] HTTPS only (in production)
- [ ] Backup strategy in place
```

### Success Indicators

- [ ] Secrets properly masked everywhere
- [ ] Rotation procedure documented and tested
- [ ] No plaintext secrets in logs
- [ ] Error messages safe to expose
- [ ] Audit checklist useful
- [ ] Team trained on procedures
- [ ] Security-focused

### Testing Strategy

```python
# production/backend/tests/test_security_secrets.py
from app.utils.secrets import SecretMasker

def test_mask_database_url():
    url = "postgresql://user:mypassword123@localhost:5432/wedding"
    masked = SecretMasker.mask(url)
    assert "mypassword123" not in masked
    assert "***REDACTED***" in masked

def test_mask_api_key():
    key = "sk-1234567890abcdef"
    masked = SecretMasker.mask(key)
    assert "1234567890abcdef" not in masked

def test_error_handler_doesnt_expose_secrets(client):
    # Trigger an error with a secret in it
    response = client.post("/api/guests", json={})
    # Should not contain any secrets in response
    assert "***REDACTED***" not in response.text  # Shouldn't expose internals

def test_no_secrets_in_logs(caplog):
    # Create guest
    create_guest("test@example.com", db)
    # Logs should not contain database password
    assert "mypassword" not in caplog.text.lower()
```

### Blockers/Dependencies

- TASK-001, TASK-002 should be completed first
- Database must be running

### Related Tasks

- Previous: TASK-002 (Environment variables)
- Next: TASK-004 (Database indexes)
- Depends on: TASK-001, TASK-002

---

## CATEGORY 2: DATABASE OPTIMIZATION

---

## TASK-004: Add Database Indexes

**Epic:** Week 2  
**Story:** Database Optimization  
**Estimate:** 90 minutes  
**Difficulty:** Medium  
**Priority:** HIGH 🟠

### Description

Database queries are currently slow because there are no indexes on frequently searched columns. Add strategic indexes to speed up queries 10-100x.

**What needs to be done:**
1. Identify columns that need indexes (commonly searched, filtered, or joined)
2. Create appropriate indexes (single-column, composite, partial)
3. Verify indexes are being used with EXPLAIN ANALYZE
4. Ensure no N+1 query problems
5. Document indexing strategy
6. Performance test before/after

### Acceptance Criteria

- [ ] Indexes created on frequently searched columns
- [ ] EXPLAIN ANALYZE shows indexes are used
- [ ] Query performance improved 10%+ minimum
- [ ] No missing indexes for WHERE/JOIN/ORDER BY columns
- [ ] Indexes don't slow down writes significantly
- [ ] Documentation explains indexing strategy
- [ ] All tests passing
- [ ] Database migration created

### Implementation Notes

**Files to Create/Modify:**
- `production/database/migrations/002_add_indexes.sql` - CREATE
- `production/backend/app/db/models.py` - Add SQLAlchemy index definitions
- `production/database/INDEXING_STRATEGY.md` - CREATE

**Analysis Phase:**
```bash
# Connect to database
psql postgresql://user:password@host:5432/wedding

# Find slow queries
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1.0  # Queries taking > 1ms
ORDER BY mean_exec_time DESC;

# Check which columns are being filtered
SELECT * FROM information_schema.columns
WHERE table_name = 'guests'
ORDER BY ordinal_position;
```

**Indexing Strategy:**

```sql
-- Single-column indexes for common searches
CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_guests_status ON guests(status);
CREATE INDEX idx_guests_created_at ON guests(created_at);

-- Composite index for common multi-column queries
CREATE INDEX idx_guests_status_created 
ON guests(status, created_at);
-- This index supports: WHERE status = ? AND created_at > ?

-- Partial index (only index confirmed guests - most common case)
CREATE INDEX idx_guests_confirmed 
ON guests(id, email) 
WHERE status = 'confirmed';

-- Verify indexes exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'guests';

-- Check if indexes are being used
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'guests'
ORDER BY idx_scan DESC;
```

**SQLAlchemy Model with Indexes:**
```python
from sqlalchemy import Column, Integer, String, DateTime, Index
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class Guest(Base):
    __tablename__ = "guests"
    
    id = Column(Integer, primary_key=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    first_name = Column(String(100), nullable=False, index=True)
    last_name = Column(String(100), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="pending", index=True)
    created_at = Column(DateTime, nullable=False, index=True)
    
    # Composite index
    __table_args__ = (
        Index('idx_guests_status_created', 'status', 'created_at'),
        Index('idx_guests_confirmed', 'id', 'email', 
              postgresql_where="status = 'confirmed'"),
    )
```

**Migration File:**
```sql
-- production/database/migrations/002_add_indexes.sql
BEGIN;

-- Single column indexes for common searches
CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_guests_status ON guests(status);
CREATE INDEX idx_guests_created_at ON guests(created_at);
CREATE INDEX idx_guests_first_name ON guests(first_name);
CREATE INDEX idx_guests_last_name ON guests(last_name);

-- Composite indexes for common multi-column queries
CREATE INDEX idx_guests_status_created ON guests(status, created_at);

-- Partial indexes (for common filtered subset)
CREATE INDEX idx_guests_confirmed 
ON guests(id, email) 
WHERE status = 'confirmed';

COMMIT;
```

### Success Indicators

- [ ] All important columns indexed
- [ ] Indexes verified with EXPLAIN ANALYZE
- [ ] Query performance tested
- [ ] No missing indexes for critical queries
- [ ] Migration file created
- [ ] Tests pass with indexes
- [ ] Performance documented
- [ ] Team trained on indexing strategy

### Testing Strategy

```bash
# Test 1: Run EXPLAIN ANALYZE before and after
psql postgresql://user:password@host:5432/wedding

-- WITHOUT INDEX (slow)
EXPLAIN ANALYZE SELECT * FROM guests WHERE email = 'test@example.com';
-- Should show "Seq Scan" (full table scan - slow)

-- CREATE INDEX
CREATE INDEX idx_guests_email ON guests(email);

-- WITH INDEX (fast)
EXPLAIN ANALYZE SELECT * FROM guests WHERE email = 'test@example.com';
-- Should show "Index Scan" (indexed lookup - fast)

-- Test 2: Python performance test
from time import time
from sqlalchemy import create_engine, select
from app.db.models import Guest

engine = create_engine(DATABASE_URL)

# Time a query with index
start = time()
with Session(engine) as session:
    for i in range(100):
        guest = session.execute(
            select(Guest).where(Guest.status == 'confirmed')
        ).scalars().first()
end = time()

print(f"100 queries: {(end - start) * 1000:.2f}ms")
# Should be fast (< 100ms for 100 queries)
```

**Automated Test:**
```python
# production/backend/tests/test_database_performance.py
def test_email_lookup_is_indexed(db_session):
    """Verify email lookups use index."""
    from sqlalchemy import event
    
    queries = []
    
    @event.listens_for(db_session, "after_cursor_execute")
    def receive_after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        queries.append(statement)
    
    # Perform query
    guest = db_session.query(Guest).filter(Guest.email == 'test@example.com').first()
    
    # Check that query uses index
    last_query = queries[-1]
    assert "Index Scan" in last_query or "index" in last_query.lower()
```

### Blockers/Dependencies

- Database must be running
- Guest table must have data
- Need understanding of EXPLAIN ANALYZE

### Related Tasks

- Previous: TASK-003 (Credential rotation)
- Next: TASK-005 (Constraints)
- Depends on: Database populated with test data

---

## TASK-005: Add Constraints & Validation

**Epic:** Week 2  
**Story:** Database Optimization  
**Estimate:** 75 minutes  
**Difficulty:** Medium  
**Priority:** HIGH 🟠

### Description

Database should enforce data integrity with constraints. Currently, invalid data can be inserted. Add constraints to ensure data quality at the database level.

**What needs to be done:**
1. Add NOT NULL constraints to required fields
2. Add UNIQUE constraints where appropriate
3. Add CHECK constraints for valid values
4. Add FOREIGN KEY constraints for relationships
5. Test that constraints are enforced
6. Document constraints strategy
7. Create migration

### Acceptance Criteria

- [ ] All required fields have NOT NULL constraint
- [ ] Unique fields have UNIQUE constraint
- [ ] Status and enum fields have CHECK constraints
- [ ] Email format validated with CHECK constraint
- [ ] Foreign keys properly configured
- [ ] Constraints tested (try to violate each one)
- [ ] Migration created
- [ ] Documentation complete

### Implementation Notes

**Files to Create/Modify:**
- `production/database/migrations/003_add_constraints.sql` - CREATE
- `production/backend/app/db/models.py` - Update model definitions
- `production/database/CONSTRAINTS_STRATEGY.md` - CREATE

**Constraints to Add:**

```sql
-- production/database/migrations/003_add_constraints.sql

BEGIN;

-- Add NOT NULL constraints to required fields
ALTER TABLE guests
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

-- Add UNIQUE constraint on email
ALTER TABLE guests
  ADD CONSTRAINT uq_guest_email UNIQUE (email);

-- Add CHECK constraints for valid values
ALTER TABLE guests
  ADD CONSTRAINT check_guest_status CHECK (
    status IN ('pending', 'confirmed', 'declined', 'attended')
  ),
  ADD CONSTRAINT check_guest_email CHECK (
    email LIKE '%@%.%'  -- Simple email format check
  );

-- Add created_at/updated_at defaults if not present
ALTER TABLE guests
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

COMMIT;
```

**SQLAlchemy Model with Constraints:**

```python
from sqlalchemy import Column, Integer, String, DateTime, CheckConstraint, UniqueConstraint
from datetime import datetime

class Guest(Base):
    __tablename__ = "guests"
    
    id = Column(Integer, primary_key=True)
    email = Column(String(255), nullable=False, unique=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'confirmed', 'declined', 'attended')",
            name='check_guest_status'
        ),
        CheckConstraint(
            "email LIKE '%@%.%'",
            name='check_valid_email'
        ),
        UniqueConstraint('email', name='uq_guest_email'),
    )
```

### Success Indicators

- [ ] All constraints enforced at database level
- [ ] Invalid data rejected by database
- [ ] Constraints documented
- [ ] Tests verify constraint enforcement
- [ ] Migration file complete
- [ ] Application handles constraint violations gracefully
- [ ] Error messages clear to user
- [ ] Performance not impacted

### Testing Strategy

```python
# production/backend/tests/test_database_constraints.py
import pytest
from sqlalchemy.exc import IntegrityError
from app.db.models import Guest
from app.db.database import SessionLocal

def test_email_required():
    """Test that email is required."""
    with pytest.raises(IntegrityError):
        guest = Guest(first_name="John", last_name="Doe")
        db.add(guest)
        db.commit()

def test_email_unique():
    """Test that duplicate emails are rejected."""
    email = "test@example.com"
    guest1 = Guest(email=email, first_name="John", last_name="Doe")
    db.add(guest1)
    db.commit()
    
    with pytest.raises(IntegrityError):
        guest2 = Guest(email=email, first_name="Jane", last_name="Doe")
        db.add(guest2)
        db.commit()

def test_status_invalid_value():
    """Test that invalid status is rejected."""
    with pytest.raises(IntegrityError):
        guest = Guest(
            email="test@example.com",
            first_name="John",
            last_name="Doe",
            status="maybe"  # Invalid status
        )
        db.add(guest)
        db.commit()

def test_invalid_email_format():
    """Test that invalid email format is rejected."""
    with pytest.raises(IntegrityError):
        guest = Guest(
            email="not-an-email",  # Invalid format
            first_name="John",
            last_name="Doe"
        )
        db.add(guest)
        db.commit()

def test_valid_guest_creation():
    """Test that valid guest is created successfully."""
    guest = Guest(
        email="valid@example.com",
        first_name="John",
        last_name="Doe",
        status="confirmed"
    )
    db.add(guest)
    db.commit()
    
    assert guest.id is not None
    assert guest.email == "valid@example.com"

def test_api_error_on_constraint_violation(client):
    """Test that API returns proper error on constraint violation."""
    response = client.post(
        "/api/guests",
        json={
            "email": "test@example.com",
            "first_name": "John",
            "last_name": "Doe"
        }
    )
    assert response.status_code == 200
    
    # Try to create duplicate
    response = client.post(
        "/api/guests",
        json={
            "email": "test@example.com",
            "first_name": "Jane",
            "last_name": "Doe"
        }
    )
    assert response.status_code == 400  # Bad request
    assert "already exists" in response.json()["detail"]
```

### Blockers/Dependencies

- TASK-004 (Indexes) should be complete
- Database must be running

### Related Tasks

- Previous: TASK-004 (Indexes)
- Next: TASK-006 (Triggers)
- Depends on: TASK-004

---

## TASK-006: Create Audit Triggers

**Epic:** Week 2  
**Story:** Database Optimization  
**Estimate:** 75 minutes  
**Difficulty:** Medium  
**Priority:** HIGH 🟠

### Description

Create database triggers to maintain an audit log of all changes. This allows us to track who changed what and when, and is required for compliance and debugging.

**What needs to be done:**
1. Create audit table to store change history
2. Create trigger function that logs all changes
3. Create triggers for INSERT, UPDATE, DELETE
4. Test that all changes are logged
5. Document audit trail usage
6. Create query to retrieve audit history

### Acceptance Criteria

- [ ] Audit table created
- [ ] Trigger function created and tested
- [ ] Inserts logged to audit table
- [ ] Updates logged with old and new values
- [ ] Deletes logged with original values
- [ ] Audit queries work correctly
- [ ] Performance impact minimal
- [ ] Documentation complete

### Implementation Notes

**Files to Create/Modify:**
- `production/database/migrations/004_create_audit_triggers.sql` - CREATE
- `production/database/AUDIT_STRATEGY.md` - CREATE
- `production/backend/app/db/models.py` - Add AuditLog model
- `production/backend/app/api/audit.py` - CREATE (optional, for audit API)

**Audit Table & Trigger Creation:**

```sql
-- production/database/migrations/004_create_audit_triggers.sql

BEGIN;

-- Create audit table to store change history
CREATE TABLE IF NOT EXISTS guest_audit (
  id SERIAL PRIMARY KEY,
  guest_id INTEGER NOT NULL REFERENCES guests(id),
  action VARCHAR(50) NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE'
  old_values JSONB,              -- Previous row values (for UPDATE/DELETE)
  new_values JSONB,              -- New row values (for INSERT/UPDATE)
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by VARCHAR(255) DEFAULT CURRENT_USER
);

-- Create index on guest_id for fast lookups
CREATE INDEX idx_guest_audit_guest_id ON guest_audit(guest_id);
CREATE INDEX idx_guest_audit_changed_at ON guest_audit(changed_at);

-- Create function to log changes
CREATE OR REPLACE FUNCTION log_guest_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO guest_audit (guest_id, action, new_values, changed_by)
    VALUES (NEW.id, 'INSERT', row_to_json(NEW), CURRENT_USER);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO guest_audit (guest_id, action, old_values, new_values, changed_by)
    VALUES (NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), CURRENT_USER);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO guest_audit (guest_id, action, old_values, changed_by)
    VALUES (OLD.id, 'DELETE', row_to_json(OLD), CURRENT_USER);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS guests_audit_trigger ON guests;
CREATE TRIGGER guests_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON guests
FOR EACH ROW
EXECUTE FUNCTION log_guest_changes();

COMMIT;
```

**Query Audit History:**

```sql
-- View all changes to a specific guest
SELECT * FROM guest_audit
WHERE guest_id = 1
ORDER BY changed_at DESC;

-- Example output:
-- | id | guest_id | action | old_values | new_values | changed_at | changed_by |
-- |----|----------|--------|-----------|-----------|-----------|-----------|
-- | 3  | 1        | UPDATE | {"status":"pending"} | {"status":"confirmed"} | 2026-06-10 10:30:00 | postgres |
-- | 2  | 1        | UPDATE | {"email":"old@example.com"} | {"email":"new@example.com"} | 2026-06-10 10:20:00 | postgres |
-- | 1  | 1        | INSERT | NULL | {"email":"old@example.com","first_name":"John"} | 2026-06-10 10:00:00 | postgres |

-- Find who changed what when
SELECT guest_id, action, changed_at, changed_by FROM guest_audit
ORDER BY changed_at DESC
LIMIT 10;

-- Find guests modified in last 24 hours
SELECT DISTINCT guest_id FROM guest_audit
WHERE changed_at > NOW() - INTERVAL '24 hours'
ORDER BY guest_id;
```

**SQLAlchemy Model:**

```python
from sqlalchemy import Column, Integer, String, DateTime, JSON
from datetime import datetime

class GuestAudit(Base):
    __tablename__ = "guest_audit"
    
    id = Column(Integer, primary_key=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    action = Column(String(50), nullable=False)  # INSERT, UPDATE, DELETE
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    changed_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    changed_by = Column(String(255), nullable=True)
```

**Query Audit Trail via API (optional):**

```python
# production/backend/app/api/audit.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import GuestAudit

router = APIRouter(prefix="/api/audit", tags=["audit"])

@router.get("/guests/{guest_id}/history")
async def get_guest_audit_history(guest_id: int, db: Session = Depends(get_db)):
    """Get audit history for a specific guest."""
    audit_entries = db.query(GuestAudit).filter(
        GuestAudit.guest_id == guest_id
    ).order_by(GuestAudit.changed_at.desc()).all()
    
    return audit_entries
```

### Success Indicators

- [ ] Audit table created and populated
- [ ] Triggers created for all operations
- [ ] Audit queries return expected results
- [ ] Performance impact minimal
- [ ] Audit trail queryable via API (if implemented)
- [ ] Documentation complete
- [ ] Tests pass
- [ ] Team understands audit trail usage

### Testing Strategy

```sql
-- Test 1: Insert trigger
INSERT INTO guests (email, first_name, last_name) 
VALUES ('test@example.com', 'John', 'Doe');

SELECT * FROM guest_audit WHERE action = 'INSERT';
-- Should show INSERT action with new_values

-- Test 2: Update trigger
UPDATE guests SET status = 'confirmed' WHERE email = 'test@example.com';

SELECT * FROM guest_audit WHERE guest_id = (SELECT id FROM guests WHERE email = 'test@example.com') AND action = 'UPDATE';
-- Should show UPDATE action with old and new values

-- Test 3: Delete trigger
DELETE FROM guests WHERE email = 'test@example.com';

SELECT * FROM guest_audit WHERE action = 'DELETE';
-- Should show DELETE action with old_values
```

```python
# production/backend/tests/test_database_audit.py
def test_insert_logged_to_audit(db_session):
    """Test that inserts are logged."""
    guest = Guest(email="test@example.com", first_name="John", last_name="Doe")
    db_session.add(guest)
    db_session.commit()
    
    audit_entry = db_session.query(GuestAudit).filter(
        GuestAudit.guest_id == guest.id,
        GuestAudit.action == 'INSERT'
    ).first()
    
    assert audit_entry is not None
    assert audit_entry.new_values['email'] == 'test@example.com'

def test_update_logged_to_audit(db_session):
    """Test that updates are logged."""
    guest = Guest(email="test@example.com", first_name="John", last_name="Doe")
    db_session.add(guest)
    db_session.commit()
    
    guest.status = 'confirmed'
    db_session.commit()
    
    audit_entry = db_session.query(GuestAudit).filter(
        GuestAudit.guest_id == guest.id,
        GuestAudit.action == 'UPDATE'
    ).order_by(GuestAudit.changed_at.desc()).first()
    
    assert audit_entry is not None
    assert audit_entry.old_values['status'] == 'pending'
    assert audit_entry.new_values['status'] == 'confirmed'

def test_delete_logged_to_audit(db_session):
    """Test that deletes are logged."""
    guest = Guest(email="test@example.com", first_name="John", last_name="Doe")
    db_session.add(guest)
    db_session.commit()
    guest_id = guest.id
    
    db_session.delete(guest)
    db_session.commit()
    
    audit_entry = db_session.query(GuestAudit).filter(
        GuestAudit.guest_id == guest_id,
        GuestAudit.action == 'DELETE'
    ).first()
    
    assert audit_entry is not None
    assert audit_entry.old_values['email'] == 'test@example.com'
```

### Blockers/Dependencies

- TASK-005 (Constraints) should be complete
- Database must be running

### Related Tasks

- Previous: TASK-005 (Constraints)
- Next: TASK-007 (GitHub Actions)
- Depends on: TASK-005

---

## CATEGORY 3: CI/CD PIPELINE SETUP

---

## TASK-007: Setup GitHub Actions Tests

**Epic:** Week 2  
**Story:** CI/CD Pipeline  
**Estimate:** 120 minutes  
**Difficulty:** Hard  
**Priority:** HIGH 🟠

### Description

Currently there's no automated testing on push. Set up GitHub Actions to run all tests automatically when code is pushed or PR is created.

**What needs to be done:**
1. Create `.github/workflows/test.yml`
2. Configure Python test environment
3. Configure Node test environment
4. Add database service (PostgreSQL)
5. Run pytest with coverage
6. Run npm test with coverage
7. Upload coverage reports
8. Configure workflow to run on push/PR

### Acceptance Criteria

- [ ] GitHub Actions workflow created
- [ ] Tests run on every push and PR
- [ ] Database service configured
- [ ] Backend tests pass in CI
- [ ] Frontend tests pass in CI
- [ ] Coverage reports generated
- [ ] Workflow status visible on PRs
- [ ] All tests must pass before merge

### Implementation Notes

**Files to Create:**
- `.github/workflows/test.yml` - CREATE

**GitHub Actions Workflow:**

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: wedding_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'
      
      - name: Install backend dependencies
        run: |
          cd production/backend
          pip install -r requirements.txt
      
      - name: Run backend tests
        env:
          DATABASE_URL: postgresql://test_user:test_password@localhost:5432/wedding_test
        run: |
          cd production/backend
          pytest tests/ -v --cov=app --cov-report=xml --cov-report=html
      
      - name: Upload backend coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./production/backend/coverage.xml
          flags: backend
          name: backend-coverage
      
      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: 'production/frontend/package-lock.json'
      
      - name: Install frontend dependencies
        run: |
          cd production/frontend
          npm ci
      
      - name: Run frontend tests
        run: |
          cd production/frontend
          npm test -- --coverage --watchAll=false
      
      - name: Upload frontend coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./production/frontend/coverage.txt
          flags: frontend
          name: frontend-coverage
```

### Success Indicators

- [ ] Workflow file valid YAML
- [ ] Tests execute in CI
- [ ] All tests pass
- [ ] Coverage reports generated
- [ ] PR checks working
- [ ] Status badges available
- [ ] Documentation complete
- [ ] Team can see test results

### Testing Strategy

1. Create workflow file
2. Push to GitHub
3. Create test PR
4. Verify workflow runs
5. Verify all tests pass
6. Verify coverage reports appear

### Blockers/Dependencies

- GitHub repository set up
- Tests must be in place (should be from Week 1)

### Related Tasks

- Previous: TASK-006 (Audit triggers)
- Next: TASK-008 (Automated deployment)
- Depends on: Tests existing in codebase

---

## TASK-008: Configure Automated Deployment

**Epic:** Week 2  
**Story:** CI/CD Pipeline  
**Estimate:** 90 minutes  
**Difficulty:** Hard  
**Priority:** HIGH 🟠

### Description

Currently deployment is manual (git push to server). Automate the deployment process using GitHub Actions so that approved PRs automatically deploy to staging/production.

**What needs to be done:**
1. Create deployment workflow (separate from test workflow)
2. Configure SSH access to deployment server
3. Create deployment script on server
4. Deploy only when tests pass
5. Configure staging and production environments
6. Add rollback capability
7. Test deployment process
8. Document deployment procedure

### Acceptance Criteria

- [ ] Deployment workflow created
- [ ] Deploys only on main branch
- [ ] Only after tests pass
- [ ] SSH access configured securely
- [ ] Both staging and production supported
- [ ] Rollback mechanism works
- [ ] Health checks after deploy
- [ ] Team knows how to deploy/rollback

### Implementation Notes

**Files to Create:**
- `.github/workflows/deploy.yml` - CREATE
- `production/scripts/deploy.sh` - CREATE

**Deployment Workflow:**

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_run:
    workflows: [Tests]
    types: [completed]
    branches: [main]

jobs:
  deploy:
    if: github.event.workflow_run.conclusion == 'success' || github.event_name == 'push'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd ~/wedding-dashboard
            ./production/scripts/deploy.sh
      
      - name: Health check
        run: |
          sleep 5
          curl -f http://${{ secrets.DEPLOY_HOST }}:3001/health || exit 1
```

**Deployment Script:**

```bash
#!/bin/bash
# production/scripts/deploy.sh

set -e  # Exit on error

echo "Starting deployment..."

# Pull latest code
git pull origin main

# Deploy backend
echo "Deploying backend..."
cd production/backend
source venv/bin/activate
pip install -r requirements.txt
# Run migrations
alembic upgrade head
# Restart service
systemctl restart wedding-backend

# Deploy frontend
echo "Deploying frontend..."
cd ../frontend
npm ci
npm run build
# Copy to web root
sudo cp -r dist/* /var/www/wedding-dashboard/

echo "Deployment complete!"

# Run smoke tests
echo "Running smoke tests..."
curl -f http://localhost:3001/api/guests
curl -f http://localhost:3000

echo "✅ Deployment successful!"
```

### Success Indicators

- [ ] Deployment happens automatically
- [ ] Tests must pass before deploy
- [ ] Server updated with latest code
- [ ] Health checks pass
- [ ] Rollback works if needed
- [ ] Team confident in deployments
- [ ] No manual steps needed

### Testing Strategy

1. Commit code to main
2. Wait for workflow to start
3. Verify tests pass
4. Verify deployment happens
5. Verify application works on server

### Blockers/Dependencies

- Test workflow must be working (TASK-007)
- Deployment server configured
- SSH access set up

### Related Tasks

- Previous: TASK-007 (GitHub Actions tests)
- Next: TASK-009 (Environment config)
- Depends on: TASK-007

---

## TASK-009: Environment-Specific Configuration

**Epic:** Week 2  
**Story:** CI/CD Pipeline  
**Estimate:** 75 minutes  
**Difficulty:** Medium  
**Priority:** HIGH 🟠

### Description

Application needs to work in multiple environments (dev, staging, production) with different configurations. Create robust environment configuration system.

**What needs to be done:**
1. Define all configuration needed per environment
2. Create `.env.example` for each environment
3. Document environment setup process
4. Verify configuration loading works
5. Test different environments
6. Create environment validation script
7. Document environment-specific procedures

### Acceptance Criteria

- [ ] Configuration files for dev/staging/prod
- [ ] All sensitive values externalized
- [ ] Environment-specific URLs/domains correct
- [ ] Configuration validated at startup
- [ ] Each environment tested independently
- [ ] Documentation clear
- [ ] Team knows how to set up new environment

### Implementation Notes

**Files to Create/Modify:**
- `production/backend/.env.example` - Template
- `production/backend/.env.production` - Production template (committed)
- `production/backend/.env.staging` - Staging template (committed)
- `production/backend/app/config.py` - Already enhanced from TASK-002
- `production/backend/scripts/validate_config.py` - CREATE

**Environment Configuration:**

```python
# production/backend/app/config.py

from enum import Enum
from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import Optional

class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

class Settings(BaseSettings):
    # Application
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False
    
    # Database
    database_url: str
    database_echo_sql: bool = False
    
    # Server
    api_host: str = "0.0.0.0"
    api_port: int = 3001
    api_url: Optional[str] = None  # Set based on environment
    
    # Frontend
    frontend_url: Optional[str] = None  # Set based on environment
    
    # CORS
    cors_origins_raw: str = "http://localhost:3000"
    
    # Security
    jwt_secret: str
    api_key_secret: str
    
    # Logging
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
    
    @property
    def cors_origins(self) -> list:
        """Get CORS origins for current environment."""
        if self.environment == Environment.PRODUCTION:
            return ["https://wedding.example.com"]
        elif self.environment == Environment.STAGING:
            return [
                "https://staging.wedding.example.com",
                "http://localhost:3000",
                "http://localhost:5173"
            ]
        else:
            return self.cors_origins_raw.split(",")
    
    @property
    def is_production(self) -> bool:
        return self.environment == Environment.PRODUCTION
    
    @property
    def is_staging(self) -> bool:
        return self.environment == Environment.STAGING
    
    @property
    def is_development(self) -> bool:
        return self.environment == Environment.DEVELOPMENT

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

**Environment Files:**

```bash
# .env.example (for development)
ENVIRONMENT=development
DEBUG=true
DATABASE_URL=postgresql://user:password@localhost:5432/wedding
DATABASE_ECHO_SQL=true
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS_RAW=http://localhost:3000,http://localhost:5173
JWT_SECRET=dev-secret-key-only
API_KEY_SECRET=dev-api-key-only
LOG_LEVEL=DEBUG
```

```bash
# .env.staging (template, committed to repo)
ENVIRONMENT=staging
DEBUG=false
DATABASE_URL=postgresql://user:password@staging-db.example.com:5432/wedding
DATABASE_ECHO_SQL=false
API_URL=https://staging-api.wedding.example.com
FRONTEND_URL=https://staging.wedding.example.com
CORS_ORIGINS_RAW=https://staging.wedding.example.com
JWT_SECRET=replace-with-staging-secret
API_KEY_SECRET=replace-with-staging-key
LOG_LEVEL=INFO
```

```bash
# .env.production (template, committed to repo)
ENVIRONMENT=production
DEBUG=false
DATABASE_URL=postgresql://user:password@prod-db.example.com:5432/wedding
DATABASE_ECHO_SQL=false
API_URL=https://api.wedding.example.com
FRONTEND_URL=https://wedding.example.com
CORS_ORIGINS_RAW=https://wedding.example.com
JWT_SECRET=replace-with-production-secret
API_KEY_SECRET=replace-with-production-key
LOG_LEVEL=WARNING
```

**Configuration Validation Script:**

```python
# production/backend/scripts/validate_config.py
#!/usr/bin/env python3

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import get_settings, Environment

def validate_config():
    """Validate that configuration is valid for current environment."""
    settings = get_settings()
    
    print(f"✓ Environment: {settings.environment}")
    print(f"✓ Database: {settings.database_url.split('@')[1] if '@' in settings.database_url else '???'}")
    print(f"✓ API URL: {settings.api_url or 'Not set'}")
    print(f"✓ Frontend URL: {settings.frontend_url or 'Not set'}")
    print(f"✓ CORS Origins: {settings.cors_origins}")
    print(f"✓ Debug: {settings.debug}")
    
    # Validation checks
    errors = []
    
    if not settings.jwt_secret or len(settings.jwt_secret) < 16:
        errors.append("JWT_SECRET is missing or too short (min 16 chars)")
    
    if not settings.api_key_secret or len(settings.api_key_secret) < 16:
        errors.append("API_KEY_SECRET is missing or too short (min 16 chars)")
    
    if settings.is_production:
        if settings.debug:
            errors.append("DEBUG cannot be true in production!")
        if "localhost" in settings.cors_origins:
            errors.append("CORS origins include localhost in production!")
        if "dev-" in settings.jwt_secret.lower():
            errors.append("JWT_SECRET appears to be development value in production!")
    
    if errors:
        print("\n❌ Configuration Errors:")
        for error in errors:
            print(f"  - {error}")
        sys.exit(1)
    else:
        print("\n✅ Configuration valid!")
        sys.exit(0)

if __name__ == "__main__":
    validate_config()
```

### Success Indicators

- [ ] Configuration works in all environments
- [ ] Different values per environment
- [ ] Validation catches configuration errors
- [ ] Team knows how to set up environments
- [ ] No secrets in committed files
- [ ] Documentation complete

### Testing Strategy

```bash
# Test dev environment
cp .env.example .env
python scripts/validate_config.py
# Should pass

# Test staging environment
cp .env.staging .env
python scripts/validate_config.py
# Should pass (after replacing secrets)

# Test production environment
cp .env.production .env
# Edit with real secrets
python scripts/validate_config.py
# Should pass
```

### Blockers/Dependencies

- TASK-008 (Deployment) should reference this configuration
- Environment templates need real values for staging/prod

### Related Tasks

- Previous: TASK-008 (Automated deployment)
- Next: TASK-010 (Test fixtures)
- Depends on: TASK-002 (Environment variables)

---

## CATEGORY 4: TESTING INFRASTRUCTURE

---

## TASK-010: Backend Test Fixtures

**Epic:** Week 2  
**Story:** Testing Infrastructure  
**Estimate:** 75 minutes  
**Difficulty:** Medium  
**Priority:** MEDIUM 🟡

### Description

Writing tests is slow because we have to create test data manually in each test. Create reusable fixtures that provide pre-built test data and database connections.

**What needs to be done:**
1. Create database session fixture
2. Create sample data fixtures (guest, vendor, budget)
3. Create client fixture (FastAPI TestClient)
4. Organize fixtures in conftest.py
5. Document fixture usage
6. Test that fixtures work
7. Make tests 30% faster using fixtures

### Acceptance Criteria

- [ ] `conftest.py` created with all fixtures
- [ ] Database session fixture works
- [ ] Sample data fixtures created (at least 3)
- [ ] TestClient fixture configured
- [ ] Existing tests updated to use fixtures
- [ ] All tests pass
- [ ] Test execution time improved
- [ ] Documentation clear

### Implementation Notes

**Files to Create/Modify:**
- `production/backend/tests/conftest.py` - CREATE
- `production/backend/tests/fixtures/guests.py` - CREATE
- `production/backend/tests/fixtures/__init__.py` - CREATE

**conftest.py:**

```python
# production/backend/tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import Base, get_db
from app.db.models import Guest

# Use in-memory SQLite for tests (fast, isolated)
TEST_DATABASE_URL = "sqlite:///./test.db"

@pytest.fixture(scope="function")
def test_db():
    """Create test database and tables."""
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    yield engine
    
    # Clean up
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session(test_db):
    """Provide database session for tests."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_db)
    session = SessionLocal()
    
    def override_get_db():
        try:
            yield session
        finally:
            session.close()
    
    app.dependency_overrides[get_db] = override_get_db
    yield session
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
def client(db_session):
    """Provide FastAPI test client."""
    return TestClient(app)

@pytest.fixture
def sample_guest():
    """Provide sample guest data."""
    return {
        "email": "john@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "status": "confirmed"
    }

@pytest.fixture
def guest_in_db(db_session, sample_guest):
    """Create a guest in database."""
    guest = Guest(**sample_guest)
    db_session.add(guest)
    db_session.commit()
    db_session.refresh(guest)
    return guest

@pytest.fixture
def multiple_guests(db_session):
    """Create multiple guests in database."""
    guests = [
        Guest(email="guest1@example.com", first_name="Guest", last_name="One", status="confirmed"),
        Guest(email="guest2@example.com", first_name="Guest", last_name="Two", status="pending"),
        Guest(email="guest3@example.com", first_name="Guest", last_name="Three", status="declined"),
    ]
    for guest in guests:
        db_session.add(guest)
    db_session.commit()
    return guests
```

**Using Fixtures in Tests:**

```python
# production/backend/tests/test_guests_with_fixtures.py

def test_create_guest_via_api(client, sample_guest):
    """Test guest creation using fixture."""
    response = client.post("/api/guests", json=sample_guest)
    assert response.status_code == 200
    assert response.json()["email"] == sample_guest["email"]

def test_update_guest(client, guest_in_db):
    """Test guest update using pre-created guest fixture."""
    response = client.put(
        f"/api/guests/{guest_in_db.id}",
        json={"status": "declined"}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "declined"

def test_list_guests_with_multiple(client, multiple_guests):
    """Test listing multiple guests."""
    response = client.get("/api/guests")
    assert response.status_code == 200
    assert len(response.json()) >= 3

def test_delete_guest(client, guest_in_db):
    """Test deleting a guest."""
    guest_id = guest_in_db.id
    response = client.delete(f"/api/guests/{guest_id}")
    assert response.status_code == 200
    
    # Verify deleted
    response = client.get(f"/api/guests/{guest_id}")
    assert response.status_code == 404
```

### Success Indicators

- [ ] Fixtures created and working
- [ ] Tests use fixtures (not creating data manually)
- [ ] All tests pass
- [ ] Test execution time improved 20%+
- [ ] Fixtures easy to understand and reuse
- [ ] Documentation clear

### Testing Strategy

Run existing tests with fixtures and measure time improvement.

### Blockers/Dependencies

- Tests must exist (from Week 1)

### Related Tasks

- Previous: TASK-009 (Environment config)
- Next: TASK-011 (Integration tests)
- Depends on: Existing test suite

---

## TASK-011: Integration Test Patterns

**Epic:** Week 2  
**Story:** Testing Infrastructure  
**Estimate:** 90 minutes  
**Difficulty:** Hard  
**Priority:** MEDIUM 🟡

### Description

Currently only have unit tests. Add integration tests that test multiple components working together (e.g., API endpoint + database).

**What needs to be done:**
1. Create integration test patterns
2. Test full request/response cycles
3. Test database persistence
4. Test error handling end-to-end
5. Test concurrent requests
6. Create test fixtures for integration
7. Document patterns
8. Achieve 20+ integration tests

### Acceptance Criteria

- [ ] Integration test module created
- [ ] Tests API + Database together
- [ ] Tests full workflows (create -> read -> update -> delete)
- [ ] Error cases tested
- [ ] Tests pass consistently
- [ ] Coverage report shows integration tests
- [ ] Documentation complete
- [ ] Team understands patterns

### Implementation Notes

**Files to Create:**
- `production/backend/tests/test_guests_integration.py` - CREATE

**Integration Test Examples:**

```python
# production/backend/tests/test_guests_integration.py

import pytest
from fastapi.testclient import TestClient
from app.main import app
from sqlalchemy.orm import Session

class TestGuestIntegration:
    """Integration tests for guest management."""
    
    def test_full_guest_lifecycle(self, client: TestClient, db_session: Session):
        """Test complete workflow: create -> read -> update -> delete."""
        
        # Create guest
        create_response = client.post(
            "/api/guests",
            json={
                "email": "lifecycle@example.com",
                "first_name": "Lifecycle",
                "last_name": "Test"
            }
        )
        assert create_response.status_code == 200
        guest_id = create_response.json()["id"]
        
        # Read guest
        read_response = client.get(f"/api/guests/{guest_id}")
        assert read_response.status_code == 200
        guest = read_response.json()
        assert guest["email"] == "lifecycle@example.com"
        
        # Update guest
        update_response = client.put(
            f"/api/guests/{guest_id}",
            json={"status": "confirmed"}
        )
        assert update_response.status_code == 200
        assert update_response.json()["status"] == "confirmed"
        
        # Verify update persisted in database
        guest_from_db = db_session.query(Guest).filter(
            Guest.id == guest_id
        ).first()
        assert guest_from_db.status == "confirmed"
        
        # Delete guest
        delete_response = client.delete(f"/api/guests/{guest_id}")
        assert delete_response.status_code == 200
        
        # Verify deleted
        get_response = client.get(f"/api/guests/{guest_id}")
        assert get_response.status_code == 404
    
    def test_list_guests_after_multiple_creates(self, client: TestClient):
        """Test listing guests after multiple creates."""
        # Create multiple guests
        emails = [f"test{i}@example.com" for i in range(5)]
        for email in emails:
            response = client.post(
                "/api/guests",
                json={
                    "email": email,
                    "first_name": "Test",
                    "last_name": "User"
                }
            )
            assert response.status_code == 200
        
        # List guests
        response = client.get("/api/guests")
        assert response.status_code == 200
        guests = response.json()
        assert len(guests) >= 5
        
        # Verify all created guests are in list
        guest_emails = {g["email"] for g in guests}
        for email in emails:
            assert email in guest_emails
    
    def test_duplicate_email_rejected(self, client: TestClient):
        """Test that duplicate emails are rejected at API level."""
        email = "duplicate@example.com"
        
        # Create first guest
        response1 = client.post(
            "/api/guests",
            json={
                "email": email,
                "first_name": "First",
                "last_name": "Guest"
            }
        )
        assert response1.status_code == 200
        
        # Try to create duplicate
        response2 = client.post(
            "/api/guests",
            json={
                "email": email,
                "first_name": "Second",
                "last_name": "Guest"
            }
        )
        assert response2.status_code == 400
        assert "already exists" in response2.json()["detail"]
    
    def test_invalid_email_rejected(self, client: TestClient):
        """Test that invalid emails are rejected."""
        response = client.post(
            "/api/guests",
            json={
                "email": "not-an-email",
                "first_name": "Invalid",
                "last_name": "Email"
            }
        )
        assert response.status_code == 422  # Validation error
    
    def test_status_filter(self, client: TestClient):
        """Test filtering guests by status."""
        # Create guests with different statuses
        for status in ["pending", "confirmed", "declined"]:
            client.post(
                "/api/guests",
                json={
                    "email": f"{status}@example.com",
                    "first_name": "Test",
                    "last_name": "User",
                    "status": status
                }
            )
        
        # Query confirmed guests
        response = client.get("/api/guests?status=confirmed")
        assert response.status_code == 200
        guests = response.json()
        assert all(g["status"] == "confirmed" for g in guests)
    
    def test_concurrent_guest_creation(self, client: TestClient):
        """Test creating multiple guests concurrently."""
        import threading
        
        results = []
        
        def create_guest(email):
            response = client.post(
                "/api/guests",
                json={
                    "email": email,
                    "first_name": "Concurrent",
                    "last_name": "Test"
                }
            )
            results.append(response.status_code)
        
        threads = [
            threading.Thread(target=create_guest, args=(f"concurrent{i}@example.com",))
            for i in range(5)
        ]
        
        for thread in threads:
            thread.start()
        
        for thread in threads:
            thread.join()
        
        # All should succeed
        assert all(code == 200 for code in results)
```

### Success Indicators

- [ ] 20+ integration tests written
- [ ] Tests cover full workflows
- [ ] Error cases tested
- [ ] Concurrent access tested
- [ ] All tests passing
- [ ] Performance acceptable
- [ ] Documentation clear
- [ ] Team understands patterns

### Testing Strategy

Run integration tests and verify they catch errors.

### Blockers/Dependencies

- TASK-010 (Fixtures) should be complete
- Test database and client fixtures working

### Related Tasks

- Previous: TASK-010 (Test fixtures)
- Next: TASK-012 (E2E tests)
- Depends on: TASK-010

---

## TASK-012: E2E Test Automation

**Epic:** Week 2  
**Story:** Testing Infrastructure  
**Estimate:** 120 minutes  
**Difficulty:** Hard  
**Priority:** MEDIUM 🟡

### Description

Currently E2E testing is manual (testing in browser). Automate browser-based tests using Playwright so tests run on every commit.

**What needs to be done:**
1. Install Playwright testing framework
2. Create E2E test suite
3. Test critical user workflows
4. Test in headless mode (for CI/CD)
5. Take screenshots on failure
6. Run as part of CI/CD pipeline
7. Document E2E testing approach
8. Create 10+ E2E tests

### Acceptance Criteria

- [ ] Playwright installed and configured
- [ ] E2E test suite created
- [ ] Critical workflows tested (add guest, list guests, edit, delete)
- [ ] Tests run in headless mode
- [ ] All tests passing locally and in CI
- [ ] Screenshots captured on failure
- [ ] CI/CD integration complete
- [ ] Documentation clear

### Implementation Notes

**Files to Create:**
- `production/frontend/tests/guests.e2e.ts` - CREATE
- `playwright.config.ts` - CREATE/Update
- `.github/workflows/e2e.yml` - CREATE (separate from unit tests)

**Playwright Configuration:**

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
```

**E2E Tests:**

```typescript
// production/frontend/tests/guests.e2e.ts
import { test, expect } from '@playwright/test';

test.describe('Guest Management', () => {
  test('user can add a new guest', async ({ page }) => {
    // Navigate to app
    await page.goto('/');
    
    // Click "Add Guest" button
    await page.click('button:has-text("Add Guest")');
    
    // Fill form
    await page.fill('[name="email"]', 'e2e@example.com');
    await page.fill('[name="firstName"]', 'E2E');
    await page.fill('[name="lastName"]', 'Test');
    
    // Submit form
    await page.click('button:has-text("Save Guest")');
    
    // Wait for success message
    await page.waitForSelector('text=Guest added successfully');
    
    // Verify guest appears in list
    const guestRow = page.locator('tr', { has: page.locator('text=E2E') });
    await expect(guestRow).toBeVisible();
  });
  
  test('user can edit a guest', async ({ page }) => {
    await page.goto('/');
    
    // Add guest first
    await page.click('button:has-text("Add Guest")');
    await page.fill('[name="email"]', 'edit@example.com');
    await page.fill('[name="firstName"]', 'Edit');
    await page.fill('[name="lastName"]', 'Test');
    await page.click('button:has-text("Save Guest")');
    
    // Click edit button
    await page.click('button:has-text("Edit")');
    
    // Change status
    await page.selectOption('select[name="status"]', 'confirmed');
    
    // Save
    await page.click('button:has-text("Save")');
    
    // Verify change
    await page.waitForSelector('text=Guest updated successfully');
  });
  
  test('user can delete a guest', async ({ page }) => {
    await page.goto('/');
    
    // Add guest
    await page.click('button:has-text("Add Guest")');
    await page.fill('[name="email"]', 'delete@example.com');
    await page.fill('[name="firstName"]', 'Delete');
    await page.fill('[name="lastName"]', 'Test');
    await page.click('button:has-text("Save Guest")');
    
    // Click delete button
    await page.click('button:has-text("Delete")');
    
    // Confirm deletion
    await page.click('button:has-text("Confirm")');
    
    // Verify deleted
    await page.waitForSelector('text=Guest deleted successfully');
    const guestRow = page.locator('text=Delete');
    await expect(guestRow).not.toBeVisible();
  });
  
  test('user can filter guests by status', async ({ page }) => {
    await page.goto('/');
    
    // Click filter button
    await page.click('button:has-text("Filter")');
    
    // Select status
    await page.selectOption('select[name="status"]', 'confirmed');
    
    // Apply filter
    await page.click('button:has-text("Apply")');
    
    // Verify all shown guests are confirmed
    const statusCells = page.locator('td:has-text("Confirmed")');
    const count = await statusCells.count();
    expect(count).toBeGreaterThan(0);
  });
  
  test('mobile responsive design', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    
    // Menu should be accessible
    await page.click('button[aria-label="Menu"]');
    
    // Add guest button should be visible
    const addButton = page.locator('button:has-text("Add Guest")');
    await expect(addButton).toBeVisible();
  });
});
```

**GitHub Actions for E2E:**

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  e2e:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: 'production/frontend/package-lock.json'
      
      - name: Install dependencies
        run: |
          cd production/frontend
          npm ci
          npx playwright install
      
      - name: Run E2E tests
        run: |
          cd production/frontend
          npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: production/frontend/playwright-report/
          retention-days: 30
```

### Success Indicators

- [ ] Playwright configured
- [ ] E2E tests written for critical paths
- [ ] Tests pass in headless mode
- [ ] Tests run on every PR
- [ ] Screenshots captured on failure
- [ ] Test results accessible
- [ ] Team confident in automated testing
- [ ] Documentation clear

### Testing Strategy

1. Write tests for each critical user workflow
2. Run locally in headed mode to verify
3. Run in headless mode to verify CI/CD compatibility
4. Check artifact uploads on failure

### Blockers/Dependencies

- Frontend must be runnable locally
- Test database needs sample data
- CI/CD environment must support Playwright

### Related Tasks

- Previous: TASK-011 (Integration tests)
- Next: TASK-013 (Logging)
- Depends on: Frontend application working

---

## CATEGORY 5: MONITORING & LOGGING

---

## TASK-013: Application Logging Framework

**Epic:** Week 2  
**Story:** Monitoring & Logging  
**Estimate:** 75 minutes  
**Difficulty:** Medium  
**Priority:** MEDIUM 🟡

### Description

Application doesn't log anything. Set up structured logging so we can track what happens and debug issues in production.

**What needs to be done:**
1. Configure Python logging framework
2. Set up JSON structured logging
3. Create log levels (DEBUG, INFO, WARNING, ERROR)
4. Log important events (create, update, delete, errors)
5. Configure log output (file + console)
6. Test logging in different scenarios
7. Document logging best practices
8. Ensure no secrets in logs

### Acceptance Criteria

- [ ] Logging framework configured
- [ ] Structured JSON logging working
- [ ] Logs go to file and console
- [ ] Log levels respected
- [ ] Important events logged
- [ ] No secrets in any logs
- [ ] Tests verify logging works
- [ ] Documentation complete

### Implementation Notes

**Files to Create/Modify:**
- `production/backend/app/logging.py` - CREATE
- `production/backend/app/config.py` - Add logging config
- `production/backend/app/main.py` - Initialize logging

**Logging Configuration:**

```python
# production/backend/app/logging.py
import logging
import logging.config
from pythonjsonlogger import jsonlogger
from app.config import get_settings

settings = get_settings()

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(name)s %(levelname)s %(message)s"
        },
        "standard": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": settings.log_level,
            "formatter": "standard",
            "stream": "ext://sys.stdout"
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": settings.log_level,
            "formatter": "json",
            "filename": "/var/log/wedding-dashboard/app.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5
        }
    },
    "root": {
        "level": settings.log_level,
        "handlers": ["console", "file"]
    }
}

logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger(__name__)

def get_logger(name: str) -> logging.Logger:
    """Get logger for module."""
    return logging.getLogger(name)
```

**Using Logging in Application:**

```python
# production/backend/app/api/guests.py
from app.logging import get_logger
from app.db.models import Guest
from app.db.schemas import GuestCreate

logger = get_logger(__name__)

@router.post("/")
async def create_guest(guest: GuestCreate, db: Session = Depends(get_db)):
    """Create a new guest."""
    try:
        logger.info(
            "Creating guest",
            extra={
                "email": guest.email,
                "first_name": guest.first_name,
                "source": "api"
            }
        )
        
        db_guest = Guest(**guest.dict())
        db.add(db_guest)
        db.commit()
        db.refresh(db_guest)
        
        logger.info(
            "Guest created successfully",
            extra={
                "guest_id": db_guest.id,
                "email": guest.email
            }
        )
        
        return db_guest
    
    except Exception as e:
        logger.error(
            "Failed to create guest",
            extra={
                "email": guest.email,
                "error": str(e)
            },
            exc_info=True  # Include stack trace
        )
        raise

@router.get("/")
async def list_guests(db: Session = Depends(get_db)):
    """List all guests."""
    logger.debug("Fetching all guests")
    
    guests = db.query(Guest).all()
    
    logger.debug(
        "Fetched guests",
        extra={"count": len(guests)}
    )
    
    return guests

@router.put("/{guest_id}")
async def update_guest(
    guest_id: int,
    guest_update: GuestUpdate,
    db: Session = Depends(get_db)
):
    """Update a guest."""
    logger.info(
        "Updating guest",
        extra={
            "guest_id": guest_id,
            "updates": guest_update.dict(exclude_unset=True)
        }
    )
    
    db_guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not db_guest:
        logger.warning(
            "Guest not found for update",
            extra={"guest_id": guest_id}
        )
        raise HTTPException(status_code=404, detail="Guest not found")
    
    for field, value in guest_update.dict(exclude_unset=True).items():
        setattr(db_guest, field, value)
    
    db.commit()
    db.refresh(db_guest)
    
    logger.info(
        "Guest updated successfully",
        extra={"guest_id": guest_id}
    )
    
    return db_guest

@router.delete("/{guest_id}")
async def delete_guest(guest_id: int, db: Session = Depends(get_db)):
    """Delete a guest."""
    logger.info(
        "Deleting guest",
        extra={"guest_id": guest_id}
    )
    
    db_guest = db.query(Guest).filter(Guest.id == guest_id).first()
    if not db_guest:
        logger.warning(
            "Guest not found for deletion",
            extra={"guest_id": guest_id}
        )
        raise HTTPException(status_code=404, detail="Guest not found")
    
    db.delete(db_guest)
    db.commit()
    
    logger.info(
        "Guest deleted successfully",
        extra={"guest_id": guest_id}
    )
    
    return {"detail": "Guest deleted"}
```

**Log Output Examples:**

```json
# Console output (standard format)
2026-06-10 10:30:15,123 [INFO] app.api.guests: Creating guest

# File output (JSON format)
{"asctime": "2026-06-10T10:30:15,123Z", "name": "app.api.guests", "levelname": "INFO", "message": "Creating guest", "email": "john@example.com", "first_name": "John", "source": "api"}

{"asctime": "2026-06-10T10:30:15,245Z", "name": "app.api.guests", "levelname": "INFO", "message": "Guest created successfully", "guest_id": 1, "email": "john@example.com"}
```

### Success Indicators

- [ ] Logging framework operational
- [ ] Structured JSON logging working
- [ ] Logs contain important business events
- [ ] No secrets in logs
- [ ] Log levels respected
- [ ] Tests verify logging works
- [ ] Documentation clear
- [ ] Team knows how to use logs

### Testing Strategy

```python
# production/backend/tests/test_logging.py
def test_guest_creation_logged(caplog, db_session):
    """Test that guest creation is logged."""
    import logging
    caplog.set_level(logging.INFO)
    
    guest = Guest(email="test@example.com", first_name="John", last_name="Doe")
    db_session.add(guest)
    db_session.commit()
    
    # Check that creation was logged
    assert "Creating guest" in caplog.text or "Guest created" in caplog.text

def test_no_secrets_in_logs(caplog):
    """Test that secrets are not logged."""
    from app.logging import get_logger
    logger = get_logger(__name__)
    
    caplog.set_level(logging.INFO)
    
    logger.info("Connection attempt", extra={"password": "secret123"})
    
    assert "secret123" not in caplog.text  # Password should never appear
```

### Blockers/Dependencies

- Python logging module (built-in)
- python-json-logger package

### Related Tasks

- Previous: TASK-012 (E2E tests)
- Next: TASK-014 (Error tracking)
- Depends on: None

---

## TASK-014: Error Tracking Integration

**Epic:** Week 2  
**Story:** Monitoring & Logging  
**Estimate:** 60 minutes  
**Difficulty:** Easy  
**Priority:** MEDIUM 🟡

### Description

Errors in production happen silently. Integrate error tracking service (like Sentry) so we're notified of errors immediately.

**What needs to be done:**
1. Choose error tracking service (Sentry recommended)
2. Create Sentry account and project
3. Install and configure Sentry SDK
4. Test error tracking works
5. Configure error notifications
6. Document error tracking process
7. Ensure PII is not sent to Sentry

### Acceptance Criteria

- [ ] Sentry account and project created
- [ ] SDK installed and configured
- [ ] Errors captured and sent to Sentry
- [ ] Notifications working
- [ ] PII filtering configured
- [ ] Tests verify integration
- [ ] Documentation complete
- [ ] Team trained on incident response

### Implementation Notes

**Files to Create/Modify:**
- `production/backend/app/error_tracking.py` - CREATE
- `production/backend/app/config.py` - Add Sentry config
- `production/backend/app/main.py` - Initialize Sentry
- `production/backend/requirements.txt` - Add sentry-sdk

**Sentry Integration:**

```python
# production/backend/app/error_tracking.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from app.config import get_settings

def init_error_tracking():
    """Initialize error tracking with Sentry."""
    settings = get_settings()
    
    if not settings.sentry_dsn:
        return  # Skip if Sentry not configured
    
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[
            FastApiIntegration(),
            SqlalchemyIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        traces_sample_rate=0.1 if settings.is_production else 1.0,
        environment=settings.environment,
        
        # Filter out PII
        before_send=before_send_sentry,
        
        # Additional context
        server_name=settings.server_name,
        release=settings.app_version,
    )

def before_send_sentry(event, hint):
    """Filter PII before sending to Sentry."""
    # Remove sensitive fields
    if 'request' in event:
        if 'cookies' in event['request']:
            event['request']['cookies'] = '***REDACTED***'
        if 'headers' in event['request']:
            # Remove Authorization headers
            headers = event['request']['headers']
            if 'Authorization' in headers:
                headers['Authorization'] = '***REDACTED***'
    
    if 'user' in event:
        # Don't send PII
        event['user'] = {
            'id': event['user'].get('id'),
            'username': event['user'].get('username'),
        }
    
    return event
```

**Using Error Tracking:**

```python
# production/backend/app/api/guests.py
from sentry_sdk import capture_exception, set_context, set_user

@router.post("/")
async def create_guest(guest: GuestCreate, db: Session = Depends(get_db)):
    try:
        db_guest = Guest(**guest.dict())
        db.add(db_guest)
        db.commit()
        return db_guest
    except Exception as e:
        # Capture with context
        set_context("guest_data", {
            "email": guest.email,
            "first_name": guest.first_name,
        })
        capture_exception(e)
        raise

# Track user actions
@router.get("/")
async def list_guests(
    current_user: str = Header(...),
    db: Session = Depends(get_db)
):
    set_user({
        "username": current_user,
        "id": current_user,
    })
    
    return db.query(Guest).all()
```

### Success Indicators

- [ ] Errors captured automatically
- [ ] Sentry dashboard shows errors
- [ ] PII not sent to Sentry
- [ ] Notifications working
- [ ] Team response documented
- [ ] Tests verify integration
- [ ] Documentation clear

### Testing Strategy

```python
# production/backend/tests/test_error_tracking.py
def test_error_captured_by_sentry(client, monkeypatch):
    """Test that errors are captured."""
    import sentry_sdk
    
    captured_events = []
    original_capture = sentry_sdk.capture_exception
    
    def mock_capture(exc):
        captured_events.append(exc)
        return original_capture(exc)
    
    monkeypatch.setattr(sentry_sdk, 'capture_exception', mock_capture)
    
    # Trigger an error
    response = client.get("/api/guests/invalid")
    
    # Verify error was captured
    assert len(captured_events) > 0
```

### Blockers/Dependencies

- Sentry account needed (free tier available)
- Network connectivity to Sentry

### Related Tasks

- Previous: TASK-013 (Logging)
- Next: TASK-015 (Performance monitoring)
- Depends on: Error handling in place

---

## TASK-015: Performance Monitoring

**Epic:** Week 2  
**Story:** Monitoring & Logging  
**Estimate:** 75 minutes  
**Difficulty:** Medium  
**Priority:** MEDIUM 🟡

### Description

Don't know if application is fast or slow in production. Set up performance monitoring to track response times, database queries, and identify bottlenecks.

**What needs to be done:**
1. Install APM (Application Performance Monitoring) tool
2. Instrument FastAPI application
3. Track endpoint response times
4. Track database query performance
5. Track external API calls
6. Create dashboards for performance metrics
7. Set up performance alerts
8. Document monitoring approach

### Acceptance Criteria

- [ ] APM tool installed (e.g., New Relic, DataDog, or Prometheus)
- [ ] All endpoints instrumented
- [ ] Database query times tracked
- [ ] Performance dashboard created
- [ ] Slow query alerts configured
- [ ] Documentation complete
- [ ] Team understands metrics
- [ ] Tests verify instrumentation

### Implementation Notes

**Files to Create/Modify:**
- `production/backend/app/monitoring.py` - CREATE (Prometheus approach)
- `production/backend/app/middleware/metrics.py` - CREATE
- `production/backend/app/config.py` - Add monitoring config
- `production/backend/requirements.txt` - Add prometheus-client

**Prometheus Monitoring:**

```python
# production/backend/app/monitoring.py
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import time

# Request metrics
http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint', 'status'],
    buckets=[0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 7.5, 10.0]
)

http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

# Database metrics
db_query_duration_seconds = Histogram(
    'db_query_duration_seconds',
    'Database query duration in seconds',
    ['table', 'operation'],  # SELECT, INSERT, UPDATE, DELETE
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
)

db_queries_total = Counter(
    'db_queries_total',
    'Total database queries',
    ['table', 'operation', 'status']  # success, error
)

# Application metrics
active_requests = Gauge(
    'active_requests',
    'Number of active requests'
)

def start_metrics_server(port: int = 8000):
    """Start Prometheus metrics server."""
    start_http_server(port)
```

**Middleware for Metrics:**

```python
# production/backend/app/middleware/metrics.py
import time
from fastapi import Request
from app.monitoring import (
    http_request_duration_seconds,
    http_requests_total,
    active_requests
)

async def metrics_middleware(request: Request, call_next):
    """Track HTTP request metrics."""
    start_time = time.time()
    active_requests.inc()
    
    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception as e:
        status_code = 500
        raise
    finally:
        duration = time.time() - start_time
        
        # Record metrics
        endpoint = request.url.path
        method = request.method
        
        http_request_duration_seconds.labels(
            method=method,
            endpoint=endpoint,
            status=status_code
        ).observe(duration)
        
        http_requests_total.labels(
            method=method,
            endpoint=endpoint,
            status=status_code
        ).inc()
        
        active_requests.dec()
    
    return response
```

**Database Query Instrumentation:**

```python
# production/backend/app/db/database.py
from sqlalchemy import event
from sqlalchemy.engine import Engine
import time
from app.monitoring import db_query_duration_seconds, db_queries_total

@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault('query_start_time', []).append(time.time())

@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total = time.time() - conn.info['query_start_time'].pop(-1)
    
    # Extract table and operation from SQL
    operation = statement.split()[0].upper()  # SELECT, INSERT, UPDATE, DELETE
    table = "unknown"
    
    try:
        # Simple extraction - in production use SQL parser
        if ' FROM ' in statement:
            table = statement.split(' FROM ')[1].split()[0]
        elif ' INSERT INTO ' in statement:
            table = statement.split(' INSERT INTO ')[1].split()[0]
        elif ' UPDATE ' in statement:
            table = statement.split(' UPDATE ')[1].split()[0]
        elif ' DELETE FROM ' in statement:
            table = statement.split(' DELETE FROM ')[1].split()[0]
    except:
        pass
    
    db_query_duration_seconds.labels(
        table=table,
        operation=operation
    ).observe(total)
    
    db_queries_total.labels(
        table=table,
        operation=operation,
        status='success'
    ).inc()
```

**Initialize in Main App:**

```python
# production/backend/app/main.py
from fastapi import FastAPI
from app.config import get_settings
from app.monitoring import start_metrics_server
from app.middleware.metrics import metrics_middleware

settings = get_settings()
app = FastAPI()

# Start metrics server
start_metrics_server(port=8001)

# Add metrics middleware
app.middleware("http")(metrics_middleware)

# Metrics endpoint (for Prometheus scraping)
@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    from prometheus_client import generate_latest
    return generate_latest()
```

**Prometheus Configuration:**

```yaml
# prometheus.yml (external file for Prometheus server)
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'wedding-api'
    static_configs:
      - targets: ['localhost:8001']

# Alert rules
rule_files:
  - 'alerts.yml'
```

```yaml
# alerts.yml
groups:
  - name: wedding
    interval: 30s
    rules:
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, http_request_duration_seconds) > 1
        for: 5m
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"
      
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}%"
      
      - alert: SlowDatabaseQueries
        expr: histogram_quantile(0.95, db_query_duration_seconds) > 0.5
        for: 5m
        annotations:
          summary: "Slow database queries detected"
          description: "95th percentile query time is {{ $value }}s"
```

### Success Indicators

- [ ] Metrics collected automatically
- [ ] Prometheus dashboard shows data
- [ ] Performance trends visible
- [ ] Slow queries identified
- [ ] Alerts configured and working
- [ ] Team monitors metrics
- [ ] Documentation clear
- [ ] Bottlenecks identified and actionable

### Testing Strategy

```python
# production/backend/tests/test_monitoring.py
def test_metrics_recorded(client):
    """Test that metrics are recorded."""
    from prometheus_client import REGISTRY
    
    # Make request
    response = client.get("/api/guests")
    assert response.status_code == 200
    
    # Check metrics were recorded
    metrics_text = client.get("/metrics").text
    assert "http_request_duration_seconds_bucket" in metrics_text
    assert "http_requests_total" in metrics_text
```

### Blockers/Dependencies

- Prometheus or APM tool installed
- Metrics endpoint accessible

### Related Tasks

- Previous: TASK-014 (Error tracking)
- Next: None (final task!)
- Depends on: APM tool availability

---

## Week 2 Summary

You've now completed 15 critical infrastructure tasks that transform the application from "feature-complete but not production-ready" to "production-hardened and monitored."

**What you built:**
- Security hardened (CORS, credentials, headers)
- Database optimized (indexes, constraints, triggers)
- CI/CD automated (tests, deployments)
- Testing complete (unit, integration, E2E)
- Observability added (logging, error tracking, metrics)

**Next:** Move to Week 3 for additional feature development on a solid, reliable foundation.

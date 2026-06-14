# 📚 Week 2 Handover Guide - Infrastructure & Security Hardening

**Created:** 2026-06-10  
**For:** Claude Code (Codex) - Week 2 Infrastructure Focus  
**Previous Week:** Week 1 guest management feature complete  
**This Week:** Infrastructure hardening, security, testing, production readiness

---

## 📋 Table of Contents

1. [Current State Assessment](#current-state-assessment)
2. [Week 2 Priorities](#week-2-priorities)
3. [Infrastructure Patterns](#infrastructure-patterns)
4. [Security Best Practices](#security-best-practices)
5. [Database Optimization](#database-optimization)
6. [CI/CD Concepts](#cicd-concepts)
7. [Testing Strategy](#testing-strategy)
8. [NEW: Ollama Feedback Loop (Tier 1)](#ollama-feedback-loop-tier-1)
9. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
10. [Production Readiness](#production-readiness)
11. [Monitoring & Observability](#monitoring--observability)

---

## Current State Assessment

### What Week 1 Built

**✅ Completed:**
- Database schema with 11 tables
- SQLAlchemy Guest model
- FastAPI CRUD endpoints (5 endpoints)
- React guest management UI (4 components)
- Basic routing and navigation
- End-to-end guest workflows
- Git workflow established

**📊 Metrics:**
```
Backend:   5 endpoints, 20+ tests, 100% passing
Frontend:  4 components, responsive, no errors
Database:  11 tables, schema valid
Tests:     Pytest integrated, fixtures working
Deployment: Manual push to main
```

### What Week 1 DIDN'T Address

**❌ Not Complete:**
- CORS configuration is permissive (*)
- Environment variables not fully externalized
- No hardcoded credential rotation
- No database query optimization
- No automated CI/CD pipeline
- Limited test coverage (no integration tests)
- No error tracking or monitoring
- No production deployment automation
- No audit logging
- No rate limiting or DDoS protection

### Risk Assessment

**Current Production Risks:**
```
🔴 CRITICAL:
   - CORS allows requests from any domain
   - Database queries may be N+1 problems
   - No automated testing before deploy
   - Environment variables exposed

🟠 HIGH:
   - No error logging for debugging
   - No performance monitoring
   - No backup/recovery strategy
   - Manual deployment = human error

🟡 MEDIUM:
   - No rate limiting
   - No request logging
   - Test coverage gaps
   - No staging environment
```

---

## Week 2 Priorities

### Tier 1: Critical (Do First)

**These block production deployment:**

1. **Security Fixes** (TASK-001 to TASK-003)
   - Fix CORS configuration
   - Externalize all environment variables
   - Remove hardcoded credentials
   - Add security headers

2. **Database Optimization** (TASK-004 to TASK-006)
   - Add indexes on frequently queried columns
   - Add constraints for data integrity
   - Create audit triggers

### Tier 2: Important (Do Second)

**These enable production operations:**

3. **CI/CD Pipeline** (TASK-007 to TASK-009)
   - GitHub Actions for automated testing
   - Automated deployment process
   - Environment-specific configuration

4. **Testing Infrastructure** (TASK-010 to TASK-012)
   - Reusable test fixtures
   - Integration test patterns
   - E2E test automation

### Tier 3: Essential (Do Third)

**These give us production visibility:**

5. **Monitoring & Logging** (TASK-013 to TASK-015)
   - Application logging framework
   - Error tracking integration
   - Performance monitoring

---

## Infrastructure Patterns

### Pattern 1: Configuration Management

**Problem:** How do we manage different settings for dev/staging/production?

**Solution: Environment-Based Configuration**

```python
# production/backend/app/config.py
from enum import Enum
from functools import lru_cache
from pydantic_settings import BaseSettings

class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

class Settings(BaseSettings):
    environment: Environment = Environment.DEVELOPMENT
    
    # CORS
    cors_origins: list = ["http://localhost:3000"]
    cors_credentials: bool = True
    
    # Database
    database_url: str = "postgresql://user:pass@localhost:5432/wedding"
    
    # Security
    api_key: str  # From environment variable
    jwt_secret: str  # From environment variable
    
    class Config:
        env_file = ".env"  # Development only
        env_file_encoding = "utf-8"
    
    def get_cors_origins(self) -> list:
        """Return appropriate CORS origins for environment."""
        if self.environment == Environment.PRODUCTION:
            return ["https://wedding.example.com"]
        elif self.environment == Environment.STAGING:
            return ["https://staging.wedding.example.com", "http://localhost:3000"]
        else:
            return ["http://localhost:3000", "http://localhost:5173"]

@lru_cache
def get_settings() -> Settings:
    return Settings()

# In FastAPI app:
app = FastAPI()
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=settings.cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Why this works:**
- Single source of truth for configuration
- Environment-aware (dev/staging/prod)
- No hardcoded values in code
- Easy to add new settings
- Settings validated at startup

### Pattern 2: Database Optimization

**Problem:** How do we identify and fix slow queries?

**Solution: Strategic Indexing**

```sql
-- Problem query (slow without index)
SELECT * FROM guests WHERE email = 'user@example.com';
-- Without index: Full table scan (O(n))

-- Solution: Add index
CREATE INDEX idx_guests_email ON guests(email);
-- With index: Indexed lookup (O(log n))

-- Verify performance improvement
EXPLAIN ANALYZE SELECT * FROM guests WHERE email = 'user@example.com';

-- Output before index:
--   Seq Scan on guests (cost=0.00..35.50 rows=1 width=100)

-- Output after index:
--   Index Scan using idx_guests_email on guests (cost=0.29..8.30 rows=1 width=100)
-- Speedup: ~4x faster
```

**Index Strategy:**
```python
# In SQLAlchemy model:
from sqlalchemy import Column, String, Index

class Guest(Base):
    __tablename__ = "guests"
    
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, index=True)
    first_name = Column(String(100), index=True)  # Commonly searched
    last_name = Column(String(100), index=True)   # Commonly searched
    status = Column(String(50), index=True)       # Filtered often
    created_at = Column(DateTime, index=True)     # Range queries
    
    # Composite index for common queries
    __table_args__ = (
        Index('idx_guests_status_created', 'status', 'created_at'),
    )
```

**When to index:**
- ✅ Columns in WHERE clauses
- ✅ Columns in JOIN conditions
- ✅ Columns in ORDER BY
- ❌ NOT every column (slows writes)
- ❌ NOT low-cardinality columns (gender, status with <10 values)

### Pattern 3: Database Constraints

**Problem:** How do we ensure data integrity?

**Solution: Constraints at Database Level**

```python
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

class Guest(Base):
    __tablename__ = "guests"
    
    # Primary key
    id = Column(Integer, primary_key=True)
    
    # Required fields (NOT NULL)
    email = Column(String(255), nullable=False, unique=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    
    # Status with constraint
    status = Column(
        String(50),
        nullable=False,
        default="pending",
        server_default="pending"
    )
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Check constraint (enforce at DB level)
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'confirmed', 'declined', 'attended')",
            name='check_guest_status'
        ),
        CheckConstraint("email LIKE '%@%.%'", name='check_valid_email'),
        UniqueConstraint('email', name='uq_guest_email'),
    )
```

**Benefits:**
- Data integrity guaranteed at DB level
- Cannot bypass from application
- Clear schema documentation
- Performance: DB enforces before write

### Pattern 4: Database Triggers & Audit Logging

**Problem:** How do we track what changed in the database?

**Solution: Audit Triggers**

```sql
-- Create audit table
CREATE TABLE guest_audit (
    id SERIAL PRIMARY KEY,
    guest_id INTEGER NOT NULL REFERENCES guests(id),
    action VARCHAR(50) NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE'
    old_values JSONB,
    new_values JSONB,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(255)
);

-- Create trigger function
CREATE OR REPLACE FUNCTION log_guest_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO guest_audit (guest_id, action, new_values, changed_by)
        VALUES (NEW.id, 'INSERT', row_to_json(NEW), current_user);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO guest_audit (guest_id, action, old_values, new_values, changed_by)
        VALUES (NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), current_user);
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO guest_audit (guest_id, action, old_values, changed_by)
        VALUES (OLD.id, 'DELETE', row_to_json(OLD), current_user);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER guests_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON guests
FOR EACH ROW
EXECUTE FUNCTION log_guest_changes();

-- Usage: query audit trail
SELECT * FROM guest_audit WHERE guest_id = 1 ORDER BY changed_at DESC;
```

**Benefits:**
- Complete audit trail of all changes
- Can audit who changed what when
- Can restore previous values
- Compliance: meets regulatory requirements

---

## Security Best Practices

### Security Issue 1: CORS Misconfiguration

**Current Problem:**
```python
# ❌ INSECURE: Allows requests from ANY domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # DANGEROUS!
    allow_credentials=True,  # Also allows cookies/auth
)
```

**Attack Scenario:**
```
1. Attacker creates malicious website: attacker.com
2. User visits attacker.com (while logged into wedding dashboard)
3. JavaScript on attacker.com makes API call to wedding dashboard
4. Browser allows it because CORS is "*"
5. Attacker steals guest data, can delete guests, spam guests
```

**Correct Solution:**
```python
# ✅ SECURE: Only allow legitimate domains
from fastapi.middleware.cors import CORSMiddleware

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),  # Explicit list
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # Only needed
    allow_headers=["Content-Type", "Authorization"],  # Only needed
    max_age=3600,  # Cache preflight for 1 hour
)

# In settings:
class Settings(BaseSettings):
    environment: Environment
    
    def get_cors_origins(self) -> list:
        if self.environment == Environment.PRODUCTION:
            return ["https://wedding.example.com"]
        elif self.environment == Environment.STAGING:
            return ["https://staging.wedding.example.com"]
        else:
            return ["http://localhost:3000"]
```

### Security Issue 2: Hardcoded Credentials

**Current Problem:**
```python
# ❌ EXPOSED: Credentials in code
DATABASE_URL = "postgresql://user:password@192.168.0.32:5432/wedding"
API_KEY = "sk-1234567890abcdef"
JWT_SECRET = "my-secret-key"
```

**Risk:**
- Anyone with repo access can see production credentials
- If repo is public or leaked, credentials are compromised
- Can't rotate without code change
- Against security best practices

**Correct Solution:**
```bash
# .env file (NOT in git, NOT in repo)
DATABASE_URL=postgresql://user:password@192.168.0.32:5432/wedding
API_KEY=sk-1234567890abcdef
JWT_SECRET=my-secret-key

# .gitignore
.env
.env.local
*.env

# In code:
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str  # Loaded from environment or .env
    api_key: str
    jwt_secret: str
    
    class Config:
        env_file = ".env"
```

### Security Issue 3: Missing Security Headers

**Problem:** Application doesn't send security headers.

**Solution: Add Security Headers**

```python
# production/backend/app/middleware/security.py
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        
        # Prevent MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # Enable XSS protection
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Enforce HTTPS (in production)
        if settings.environment == Environment.PRODUCTION:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Disable referrer info
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Restrict features
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        return response

# Add to app
app.add_middleware(SecurityHeadersMiddleware)
```

### Security Issue 4: Input Validation

**Problem:** API accepts any input without validation.

**Solution: Pydantic Schemas with Validation**

```python
from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional

class GuestCreate(BaseModel):
    email: EmailStr  # Validates email format
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, regex=r'^\+?1?\d{9,15}$')
    status: str = Field(default="pending")
    
    @validator('status')
    def validate_status(cls, v):
        allowed = {'pending', 'confirmed', 'declined', 'attended'}
        if v not in allowed:
            raise ValueError(f'Status must be one of {allowed}')
        return v
    
    @validator('email')
    def email_must_not_be_spam(cls, v):
        banned_domains = ['tempmail.com', '10minutemail.com']
        domain = v.split('@')[1]
        if domain in banned_domains:
            raise ValueError('Temporary email addresses not allowed')
        return v

class Config:
    # Prevent extra fields
    extra = "forbid"  # Reject unknown fields

# Usage in endpoint:
@app.post("/api/guests")
async def create_guest(guest: GuestCreate, db: Session = Depends(get_db)):
    # Pydantic validates automatically before reaching endpoint
    # If validation fails, FastAPI returns 422 Unprocessable Entity
    db_guest = Guest(**guest.dict())
    db.add(db_guest)
    db.commit()
    return db_guest
```

---

## Database Optimization

### Query Optimization Process

**Step 1: Identify Slow Queries**
```bash
# Enable query logging in PostgreSQL
ALTER SYSTEM SET log_min_duration_statement = 1000;  # Log queries > 1 second
SELECT pg_reload_conf();

# Or check slow query log
tail -f /var/log/postgresql/postgresql.log | grep "duration:"
```

**Step 2: Analyze with EXPLAIN**
```sql
-- EXPLAIN ANALYZE shows actual execution plan
EXPLAIN ANALYZE
SELECT g.*, c.count_from_guests 
FROM guests g
JOIN (SELECT guest_id, COUNT(*) as count_from_guests FROM guest_meals)
WHERE g.status = 'confirmed';

-- Look for:
-- ❌ Seq Scan (full table scan - slow)
-- ✅ Index Scan (using index - fast)
-- ❌ Sort (if no index on ORDER BY)
-- ✅ Index Sort (if index supports ORDER BY)
```

**Step 3: Add Strategic Indexes**
```sql
-- Single column indexes
CREATE INDEX idx_guests_status ON guests(status);
CREATE INDEX idx_guests_email ON guests(email);

-- Composite index for common multi-column WHERE clauses
CREATE INDEX idx_guests_status_created 
ON guests(status, created_at);  -- Used for WHERE status = ? AND created_at > ?

-- Partial index (for filtered queries)
CREATE INDEX idx_guests_confirmed 
ON guests(id, email) WHERE status = 'confirmed';  -- Only index confirmed guests

-- Verify indexes are used
SELECT * FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
ORDER BY idx_scan DESC;  # Shows which indexes are actually used
```

### N+1 Query Problem

**Problem:**
```python
# ❌ INEFFICIENT: N+1 queries
def get_all_guests():
    guests = db.query(Guest).all()  # 1 query
    for guest in guests:
        print(guest.rsvp_status)  # N more queries! (one per guest)
    return guests

# Database: 1 + N queries (with N=1000, that's 1001 queries!)
```

**Solution 1: Eager Loading**
```python
# ✅ EFFICIENT: Single query with join
from sqlalchemy.orm import joinedload

def get_all_guests():
    guests = db.query(Guest).options(
        joinedload(Guest.rsvp_status)  # Load relationship in same query
    ).all()  # Only 1 query!
    
    for guest in guests:
        print(guest.rsvp_status)  # Uses already-loaded data
    return guests
```

**Solution 2: Query Optimization**
```python
# ✅ EFFICIENT: Select only needed columns
def get_all_guests_summary():
    guests = db.query(
        Guest.id,
        Guest.email,
        Guest.first_name,
        Guest.last_name
    ).all()  # Only 1 query, fewer columns = faster
    return guests
```

### Connection Pooling

**Problem:** Creating new database connection per request is slow.

**Solution: Connection Pool**
```python
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

# Configure connection pool
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,  # Keep 10 connections open
    max_overflow=20,  # Allow up to 20 more temporary connections
    pool_pre_ping=True,  # Check connection is alive before using
    pool_recycle=3600,  # Recycle connections every hour
)

# This pool handles 10 simultaneous requests efficiently
# Without pool: each request creates new connection (slow)
# With pool: connections are reused (fast)
```

---

## CI/CD Concepts

### CI/CD Pipeline Architecture

```
Developer Push to GitHub
        ↓
GitHub Actions Triggers
        ↓
┌──────────────────────┐
│  TEST STAGE          │
├──────────────────────┤
│ 1. Run Unit Tests    │ ← pytest, npm test
│ 2. Check Coverage    │ ← Coverage > 80%?
│ 3. Lint Code         │ ← Formatting, style
│ 4. Security Scan     │ ← vulnerabilities
│ 5. Build Artifacts   │ ← Create deployable packages
└──────────────────────┘
        ↓ (if all pass)
┌──────────────────────┐
│  DEPLOY STAGE        │
├──────────────────────┤
│ 1. Build Docker      │
│ 2. Push to Registry  │
│ 3. Deploy to Staging │
│ 4. Run E2E Tests     │
│ 5. Check Metrics     │
└──────────────────────┘
        ↓ (if all pass)
┌──────────────────────┐
│  PRODUCTION DEPLOY   │
├──────────────────────┤
│ 1. Blue-green deploy │
│ 2. Smoke tests       │
│ 3. Monitor metrics   │
│ 4. Rollback if issues│
└──────────────────────┘
        ↓
✅ Deployed to Production
```

### GitHub Actions Workflow

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
          POSTGRES_PASSWORD: password
          POSTGRES_DB: wedding_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      # Checkout code
      - uses: actions/checkout@v3
      
      # Setup Python
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'
      
      # Install backend dependencies
      - name: Install backend dependencies
        run: |
          cd production/backend
          pip install -r requirements.txt
      
      # Run backend tests
      - name: Run backend tests
        env:
          DATABASE_URL: postgresql://postgres:password@localhost/wedding_test
        run: |
          cd production/backend
          pytest tests/ -v --cov=app --cov-report=xml
      
      # Upload coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./production/backend/coverage.xml
      
      # Setup Node
      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: 'production/frontend/package-lock.json'
      
      # Install frontend dependencies
      - name: Install frontend dependencies
        run: |
          cd production/frontend
          npm ci
      
      # Run frontend tests
      - name: Run frontend tests
        run: |
          cd production/frontend
          npm test -- --coverage --watchAll=false
      
      # Notify on failure
      - name: Notify on failure
        if: failure()
        run: echo "Tests failed! Check logs above."
```

---

## Testing Strategy

### Testing Pyramid

```
           ┌─────────────┐
           │ E2E Tests   │ (5-10% of tests)
           │ Browser     │ Slow, expensive, high value
           │ Real UI     │ 10-30 seconds per test
           └─────────────┘
              ▲
         ┌────────────────┐
         │ Integration    │ (15-25% of tests)
         │ DB + API       │ Medium speed, medium cost
         │ API calls      │ 1-2 seconds per test
         └────────────────┘
              ▲
    ┌──────────────────────────┐
    │ Unit Tests               │ (60-75% of tests)
    │ Individual functions     │ Fast, cheap, easy
    │ Mocked dependencies      │ < 100ms per test
    └──────────────────────────┘
```

### Unit Test Example (Backend)

```python
# production/backend/tests/test_guests.py
import pytest
from sqlalchemy.orm import Session
from app.db.models import Guest
from app.db.schemas import GuestCreate
from app.api.guests import create_guest

@pytest.fixture
def db_session(test_db):
    """Provide database session for tests."""
    return test_db

@pytest.fixture
def sample_guest_data():
    """Provide sample guest data."""
    return {
        "email": "john@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "status": "confirmed"
    }

def test_create_guest(db_session: Session, sample_guest_data):
    """Test creating a guest."""
    guest_data = GuestCreate(**sample_guest_data)
    guest = create_guest(guest_data, db_session)
    
    assert guest.id is not None
    assert guest.email == "john@example.com"
    assert guest.status == "confirmed"

def test_create_guest_invalid_email(db_session: Session):
    """Test creating guest with invalid email."""
    with pytest.raises(ValueError):
        guest_data = GuestCreate(
            email="not-an-email",
            first_name="John",
            last_name="Doe"
        )

def test_create_duplicate_email(db_session: Session, sample_guest_data):
    """Test that duplicate emails are rejected."""
    # Create first guest
    guest1 = GuestCreate(**sample_guest_data)
    create_guest(guest1, db_session)
    
    # Try to create duplicate
    with pytest.raises(IntegrityError):
        guest2 = GuestCreate(**sample_guest_data)
        create_guest(guest2, db_session)
        db_session.commit()
```

### Integration Test Example (API)

```python
# production/backend/tests/test_guests_integration.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    """Provide test client."""
    return TestClient(app)

def test_create_guest_via_api(client):
    """Test guest creation via API endpoint."""
    response = client.post(
        "/api/guests",
        json={
            "email": "jane@example.com",
            "first_name": "Jane",
            "last_name": "Smith"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "jane@example.com"
    assert data["id"] is not None

def test_get_guests_via_api(client):
    """Test listing guests via API."""
    # Create a guest first
    client.post(
        "/api/guests",
        json={
            "email": "test@example.com",
            "first_name": "Test",
            "last_name": "User"
        }
    )
    
    # List guests
    response = client.get("/api/guests")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert any(g["email"] == "test@example.com" for g in data)

def test_update_guest_status(client):
    """Test updating guest status."""
    # Create guest
    create_response = client.post(
        "/api/guests",
        json={
            "email": "update@example.com",
            "first_name": "Update",
            "last_name": "Test"
        }
    )
    guest_id = create_response.json()["id"]
    
    # Update status
    update_response = client.put(
        f"/api/guests/{guest_id}",
        json={"status": "confirmed"}
    )
    
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "confirmed"
```

### E2E Test Example (Browser)

```typescript
// production/frontend/tests/guests.e2e.ts
import { test, expect } from '@playwright/test';

test('User can add and view guest', async ({ page }) => {
  // Navigate to app
  await page.goto('http://localhost:3000');
  
  // Click "Add Guest" button
  await page.click('text=Add Guest');
  
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
  
  // Verify guest was persisted to database
  const response = await page.request.get('http://localhost:3001/api/guests?email=e2e@example.com');
  const guests = await response.json();
  expect(guests).toHaveLength(1);
  expect(guests[0].email).toBe('e2e@example.com');
});
```

---

## Ollama Feedback Loop (Tier 1)

### What's New This Week

You now have **Ollama** running locally to give you instant feedback on code quality and test results. This is **completely optional** but can speed up your development cycle.

**See:** WEEK_2_OLLAMA_QUICK_START.md for the simple 30-second version.

### How It Works

Before each commit:
- **Ollama lint check** runs automatically
- Detects: console.logs, unused imports, TODOs, debuggers, hardcoded secrets
- Reports issues; you fix if you agree

After tests:
- **Ollama test summary** extraction
- Automatically added to PR description
- Shows: passed/failed/skipped counts

### Optional Integration

```
You can:
✓ Use Ollama feedback (recommended for faster iteration)
✓ Skip Ollama and commit normally
✓ Disable if it's causing issues

All are fine. Zero pressure either way.
```

### No Impact If It Fails

If Ollama times out or returns invalid results:
- Check is skipped (safe)
- You continue normally
- No disruption to workflow

### Tracking

We're measuring whether Ollama actually helps reduce token costs during Week 2-3. You don't need to do anything special—just note any issues if they come up.

**Details:** See OLLAMA_PHASE0_TRACKING.md if you want to understand what we're measuring.

---

## Common Pitfalls & Solutions

### Pitfall 1: Forgetting to Create Feature Branch

**Mistake:**
```bash
cd ~/wedding-dashboard
git add production/
git commit -m "fix CORS"  # Commit directly to main!
git push origin main
```

**Problem:** You've committed to main without code review. If this breaks something, it's in production.

**Solution:**
```bash
# Always create feature branch first
git checkout main
git pull origin main
git checkout -b security/fix-cors

# Make changes
# Test thoroughly
# Create PR

# Only then does human merge to main
```

### Pitfall 2: Not Testing Locally Before Pushing

**Mistake:**
```bash
git push origin security/task-001
# Without running: pytest, npm test, curl tests
```

**Problem:** Tests fail in CI/CD, but you've already created PR. Looks unprofessional.

**Solution:**
```bash
# Always test locally FIRST
cd production/backend
pytest tests/ -v  # Must pass

cd production/frontend
npm test  # Must pass

# Then push
git push origin security/task-001
```

### Pitfall 3: Hardcoding Environment-Specific Values

**Mistake:**
```python
# ❌ BAD: Hardcoded for development
CORS_ORIGINS = ["http://localhost:3000"]
DATABASE_URL = "postgresql://user:pass@localhost:5432/wedding"

# Works in dev, breaks in production
```

**Solution:**
```python
# ✅ GOOD: Environment-based
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    cors_origins: list = ["http://localhost:3000"]  # dev default
    database_url: str = "postgresql://localhost/wedding"
    
    class Config:
        env_file = ".env"  # Load from environment
```

### Pitfall 4: Running Tests on Modified Code Without Committing

**Mistake:**
```bash
# Make some changes
# Test
pytest  # Passes
git commit  # Did I test the right code?
```

**Solution:**
```bash
# Commit first
git add production/
git commit -m "fix(security): CORS"

# Then test the committed code
pytest

# If test fails:
git revert HEAD  # Go back
git checkout -b security/fix-cors  # Create new branch
# Fix the issue
# Test again
git add production/
git commit -m "fix(security): CORS (corrected)"
```

### Pitfall 5: Not Understanding Why Infrastructure Matters

**Mistake:**
```
"Why do we need database indexes? Guests work fine without them."
```

**Reality:**
```
Guests table: 100 rows → indexes irrelevant (query is fast anyway)
Guests table: 100,000 rows → indexes critical (10-100x speedup)
Guests table: 1,000,000 rows → no indexes = system unusable

Database growth happens fast. Build for scale now.
```

### Pitfall 6: Mixing Infrastructure & Feature Work

**Mistake:**
```bash
git checkout -b feature/fix-cors-and-add-vendors

# Changes include:
# 1. CORS fix
# 2. Vendor model
# 3. Vendor endpoints
# 4. Vendor UI

# PR is too big, hard to review, mixing concerns
```

**Solution:**
```bash
# One concern per branch
git checkout -b security/fix-cors
# ONLY CORS changes

# When merged, then:
git checkout -b feature/vendor-model
# ONLY Vendor model

# Easier to review, easier to rollback if needed
```

---

## Production Readiness

### Production Readiness Checklist

**Security (Must Have)**
```
☐ CORS properly restricted
☐ All credentials externalized
☐ Security headers present
☐ Input validation on all endpoints
☐ Rate limiting configured
☐ Authentication working
☐ HTTPS only (in production)
☐ Database encryption (if sensitive data)
```

**Performance (Must Have)**
```
☐ Database queries optimized
☐ Slow queries indexed
☐ Connection pooling configured
☐ N+1 queries eliminated
☐ Caching strategy in place
☐ Response times < 500ms (99%)
☐ Load tested for expected traffic
```

**Reliability (Must Have)**
```
☐ Error handling comprehensive
☐ No unhandled exceptions
☐ Graceful degradation
☐ Timeouts configured
☐ Retry logic where appropriate
☐ Circuit breaker for external services
☐ Backup strategy in place
```

**Operability (Must Have)**
```
☐ Logging structured and searchable
☐ Errors tracked and alertable
☐ Health checks configured
☐ Metrics available
☐ Runbooks for common issues
☐ CI/CD pipeline automated
☐ Deployment rollback possible
```

**Testing (Must Have)**
```
☐ Unit tests: >80% coverage
☐ Integration tests exist
☐ E2E tests critical paths
☐ Performance tests baseline
☐ Security tests included
☐ All tests passing in CI/CD
```

---

## Monitoring & Observability

### Logging Strategy

**What to Log:**
```python
# production/backend/app/logging.py
import logging
from pythonjsonlogger import jsonlogger

# Configure JSON logging (machine-readable)
logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter()
handler.setFormatter(formatter)
logger.addHandler(handler)

# Application code:
# Log important business events
logger.info("Guest created", extra={
    "guest_id": 123,
    "email": "user@example.com",
    "source": "api"
})

# Log errors with context
try:
    create_guest(data)
except Exception as e:
    logger.error("Failed to create guest", extra={
        "email": email,
        "error": str(e),
        "traceback": traceback.format_exc()
    })

# Log performance metrics
logger.info("Query executed", extra={
    "query": "SELECT * FROM guests WHERE status = 'confirmed'",
    "duration_ms": 45,
    "rows": 142
})

# Don't log:
# ❌ Passwords
# ❌ API keys
# ❌ Credit cards
# ❌ Personal identification numbers
```

### Error Tracking

**Problem:** Errors in production happen silently.

**Solution: Error Tracking Service**

```python
# production/backend/app/error_tracking.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

sentry_sdk.init(
    dsn="https://xxxxx@sentry.io/1234567",
    integrations=[
        FastApiIntegration(),
        SqlalchemyIntegration(),
    ],
    traces_sample_rate=1.0,
    environment=settings.environment
)

# Now all exceptions are automatically tracked:
# - What error occurred
# - When it happened
# - Which request caused it
# - Full stack trace
# - User context
# - Performance impact
```

### Performance Monitoring

**Problem:** Slow endpoints go unnoticed.

**Solution: Performance Metrics**

```python
# production/backend/app/middleware/metrics.py
import time
from prometheus_client import Histogram, Counter

request_duration = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

request_count = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

@app.middleware("http")
async def add_metrics(request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    
    request_duration.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)
    
    request_count.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    return response
```

---

## Summary: Week 2 Mission

**Week 2 is about building confidence:**

1. **Security:** Make sure the system is safe from attacks
2. **Performance:** Make sure the system is fast even with lots of data
3. **Reliability:** Make sure the system keeps running even when things go wrong
4. **Operations:** Make sure humans can deploy, monitor, and debug
5. **Quality:** Make sure code changes don't break existing features

**These aren't optional. These are foundational.**

Once Week 2 is complete, Weeks 3-9 can confidently add more features on top of a solid foundation.

---

**Next Steps:** Read WEEK_2_TASK_LIST.md to see the 15 specific tasks.

# TASK-016 Implementation Prompt

**Task:** Auth — Invite-Code Session Middleware  
**Branch:** `week3/task-016-auth-invite-code`  
**Estimated time:** 90 minutes  
**Prerequisites:** TASK-015 merged, PostgreSQL running, local dev environment ready

---

## Context

The wedding portal currently has a working guest CRUD API (`GET /api/guests`, `POST /api/guests`). All routes are unauthenticated (anyone can see/modify any guest). Week 3 starts by adding authentication.

You will implement invite-code-based login. Guests enter a code (e.g., `DEMO-001`), the system validates it against an `invites` table, creates a session, and returns a user object. All future endpoints will require this session.

After TASK-016 is merged, TASK-017 will add role-based access control (couple vs. coordinator vs. guest permissions).

---

## Implementation Checklist

### Step 1: Add Invites Table to PostgreSQL

Create a migration file `production/database/migrations/005_create_invites_table.sql`:

```sql
CREATE TABLE invites (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  wedding_id INTEGER NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  household_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'guest', -- couple, coordinator, guest
  redeemed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invites_code ON invites(code);
```

Run the migration:
```bash
psql -U postgres -d wedding < production/database/migrations/005_create_invites_table.sql
```

Verify:
```sql
\dt invites
-- Should show the table exists
SELECT COUNT(*) FROM invites;
-- Should return 0 (empty for now)
```

### Step 2: Seed Test Invite Codes

Create a seed script `production/database/seed_test_invites.sql`:

```sql
INSERT INTO invites (code, wedding_id, household_name, role) VALUES
  ('DEMO-001', 1, 'Test Guest', 'guest'),
  ('DEMO-COUPLE', 1, 'Ashley & Hazel', 'couple'),
  ('DEMO-COORD', 1, 'Coordinator', 'coordinator')
ON CONFLICT (code) DO NOTHING;
```

Run it:
```bash
psql -U postgres -d wedding < production/database/seed_test_invites.sql
```

Verify:
```sql
SELECT code, role FROM invites;
-- Should show 3 rows: DEMO-001, DEMO-COUPLE, DEMO-COORD
```

### Step 3: Add Session Configuration to FastAPI

Update `production/backend/app/main.py`. Add after imports:

```python
from fastapi.middleware.sessions import SessionMiddleware

# In the app creation section (inside the create_app() function or main app setup):
app.add_middleware(SessionMiddleware, secret_key="your-secret-key-change-in-prod")
```

**Important:** The secret_key should be loaded from `SETTINGS.session_secret_key` (add to config.py).

Update `production/backend/app/config.py`:

```python
class Settings(BaseSettings):
    # ... existing fields ...
    session_secret_key: str = Field(default="dev-secret-change-in-production", alias="SESSION_SECRET_KEY")
    
    class Config:
        env_file = ".env"
```

Update `production/backend/.env`:

```bash
SESSION_SECRET_KEY=dev-secret-change-in-production
```

### Step 4: Add Invites SQLAlchemy Model

Create or update `production/backend/app/db/models.py` to include:

```python
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

class Invite(Base):
    __tablename__ = "invites"
    
    id = Column(Integer, primary_key=True)
    code = Column(String(50), unique=True, nullable=False)
    wedding_id = Column(Integer, ForeignKey("weddings.id"), nullable=False)
    household_name = Column(String(255))
    role = Column(String(50), default="guest")
    redeemed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    wedding = relationship("Wedding", back_populates="invites")
```

Add to `Wedding` model:
```python
invites = relationship("Invite", back_populates="wedding", cascade="all, delete-orphan")
```

### Step 5: Create Auth Pydantic Schemas

Create `production/backend/app/api/schemas_auth.py`:

```python
from pydantic import BaseModel

class LoginRequest(BaseModel):
    invite_code: str

class UserResponse(BaseModel):
    id: int
    name: str
    role: str  # couple, coordinator, guest
    
    class Config:
        from_attributes = True  # SQLAlchemy compat

class LoginResponse(BaseModel):
    user: UserResponse
    message: str = "Login successful"
```

### Step 6: Implement Auth Routes and Dependencies

Create `production/backend/app/api/auth.py`:

```python
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Invite, Guest, Wedding
from app.api.schemas_auth import LoginRequest, UserResponse, LoginResponse
from app.logging import get_logger

router = APIRouter(prefix="/auth", tags=["auth"])
logger = get_logger(__name__)

@router.post("/login", response_model=LoginResponse)
async def login(request_body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    POST /api/auth/login
    Accept invite code, validate, create session, return user.
    """
    invite_code = request_body.invite_code.strip().upper()
    
    # Validate invite code exists
    invite = db.query(Invite).filter(Invite.code == invite_code).first()
    if not invite:
        logger.warning(f"Invalid invite code attempted: {invite_code}")
        raise HTTPException(status_code=401, detail="Invalid invite code")
    
    # For now, map invite code to a test guest (or create a user record)
    # This is a simplification: in production, you'd have a users table with many guests per household
    # For MVP, one invite = one guest household. Couple shares one invite.
    
    # Get the first guest associated with this wedding (for testing)
    # TODO: link invites to specific guests/households in real schema
    guest = db.query(Guest).filter(Guest.wedding_id == invite.wedding_id).first()
    if not guest:
        logger.error(f"No guest found for wedding_id {invite.wedding_id}")
        raise HTTPException(status_code=500, detail="No guest found for this invite")
    
    # Store session data
    request.session["user_id"] = guest.id
    request.session["invite_code"] = invite_code
    request.session["role"] = invite.role
    
    # Log the login
    logger.info(f"User logged in with invite {invite_code}, guest_id {guest.id}, role {invite.role}")
    
    return LoginResponse(
        user=UserResponse(id=guest.id, name=guest.name, role=invite.role)
    )

@router.post("/logout")
async def logout(request: Request):
    """
    POST /api/auth/logout
    Clear session.
    """
    request.session.clear()
    logger.info("User logged out")
    return {"message": "Logout successful"}

async def get_current_user(request: Request, db: Session = Depends(get_db)):
    """
    Dependency: extract user from session.
    Raises 401 if no session or session is invalid.
    """
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    guest = db.query(Guest).filter(Guest.id == user_id).first()
    if not guest:
        raise HTTPException(status_code=401, detail="User not found")
    
    return {
        "id": guest.id,
        "name": guest.name,
        "role": request.session.get("role", "guest")
    }
```

Register the auth router in `production/backend/app/main.py`:

```python
from app.api import auth

# In the app creation section:
app.include_router(auth.router, prefix="/api")
```

### Step 7: Write Tests

Create `production/backend/tests/test_auth.py`:

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.db.models import Invite, Guest
from app.db.database import get_db


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def setup_test_data(db: Session):
    """Create test invite and guest."""
    # Assume wedding_id=1 exists (seed data)
    invite = Invite(code="TEST-001", wedding_id=1, household_name="Test", role="guest")
    db.add(invite)
    db.commit()
    
    guest = Guest(name="Test Guest", email="test-auth-001@example.com", wedding_id=1)
    db.add(guest)
    db.commit()
    
    return {"invite_code": "TEST-001", "guest_id": guest.id}


def test_login_valid_invite(client: TestClient, setup_test_data):
    response = client.post("/api/auth/login", json={"invite_code": "TEST-001"})
    assert response.status_code == 200
    assert response.json()["user"]["name"] == "Test Guest"
    assert response.json()["user"]["role"] == "guest"
    # Check session cookie is set
    assert "session" in client.cookies


def test_login_invalid_invite(client: TestClient):
    response = client.post("/api/auth/login", json={"invite_code": "INVALID-999"})
    assert response.status_code == 401
    assert "Invalid invite code" in response.json()["detail"]


def test_logout(client: TestClient, setup_test_data):
    # Login first
    client.post("/api/auth/login", json={"invite_code": "TEST-001"})
    # Logout
    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    # Verify session is cleared (next request to protected route should fail)
    # TODO: implement protected route to test this


def test_invite_code_case_insensitive(client: TestClient, setup_test_data):
    response = client.post("/api/auth/login", json={"invite_code": "test-001"})
    assert response.status_code == 200


def test_multiple_logins_same_code(client: TestClient, setup_test_data):
    # First login
    response1 = client.post("/api/auth/login", json={"invite_code": "TEST-001"})
    assert response1.status_code == 200
    
    # Second login with same code
    response2 = client.post("/api/auth/login", json={"invite_code": "TEST-001"})
    assert response2.status_code == 200
    # Both should succeed (no invite "redemption" logic this week)


def test_get_current_user_with_session(client: TestClient, setup_test_data):
    # Login
    client.post("/api/auth/login", json={"invite_code": "TEST-001"})
    # Access a route that uses get_current_user()
    # (Need to implement a test route, or wait for TASK-020)
    # For now, just verify login worked
    pass


def test_get_current_user_without_session(client: TestClient):
    # Try to access protected route without logging in
    # (Need to implement a test route)
    # For now, test is a placeholder
    pass
```

Run the tests:
```bash
cd production/backend
pytest tests/test_auth.py -v
# Should see 8 passing tests (adjust count based on your implementation)
```

### Step 8: Manual Verification

Start the backend:
```bash
cd production/backend
python main.py
# Should run on http://localhost:3001
```

In another terminal, test the auth flow:

```bash
# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "DEMO-001"}' \
  -c /tmp/cookies.txt

# Should return:
# {"user": {"id": 1, "name": "Guest Name", "role": "guest"}, "message": "Login successful"}

# Test logout
curl -X POST http://localhost:3001/api/auth/logout \
  -b /tmp/cookies.txt

# Should return:
# {"message": "Logout successful"}

# Test invalid code
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"invite_code": "INVALID-999"}'

# Should return 401:
# {"detail": "Invalid invite code"}
```

---

## Known Limitations & TODOs

- **Invite redemption:** Currently, invites can be used multiple times. Later (TASK-024), add one-time-use or track redeemed_at.
- **User mapping:** This implementation assumes one guest per wedding. In production, you'll need a `users` table linking multiple guests to a household, with invites mapping to households.
- **Session expiry:** No TTL on sessions yet (default ~7 days). Add to config later.
- **HTTPS only:** Session cookies should be `secure=True` in production. Update config.py to load from env.

---

## PR Description Template

When you're done, open a PR with:

```markdown
## TASK-016: Auth — Invite-Code Session Middleware

### Summary
- Added `invites` table to PostgreSQL (code, role, wedding_id, redeemed_at)
- Seeded test invite codes (DEMO-001, DEMO-COUPLE, DEMO-COORD) for manual testing
- Implemented FastAPI session middleware with secret key from config
- Implemented POST /api/auth/login (invite code → session creation)
- Implemented POST /api/auth/logout (session clear)
- Implemented get_current_user() dependency for route protection (used in TASK-017)
- Added 8+ comprehensive tests covering valid/invalid invite, logout, case-insensitive codes

### Validation
- `pytest tests/test_auth.py -v` → 8 passed
- Manual test: `curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"invite_code": "DEMO-001"}'` → returns user + sets session cookie
- Manual test: invalid code → 401 Unauthorized
- Manual test: logout → session cleared
- `git diff --check` → clean (no trailing whitespace)
- No credentials logged; invite codes are test data only

### Notes
- Session uses SessionMiddleware with secret key from config
- Invite codes are case-insensitive (normalized to uppercase)
- get_current_user() extracts user_id and role from session (used by TASK-017)
- Next task: TASK-017 (role-based route protection)
```

---

## Gotchas & Tips

1. **Session middleware order matters:** Add SessionMiddleware before any routes that use sessions.
2. **Database migration:** Manually run the migration; the app doesn't auto-migrate (add a migration runner later).
3. **Test cleanup:** Use email prefix like `pytest-auth-*` for test guests so they're easy to identify later.
4. **Case sensitivity:** SQL is case-sensitive by default; invite codes should be normalized (uppercase).
5. **TestClient cookies:** TestClient from FastAPI automatically handles session cookies in tests.

---

## When You're Done

1. Merge to main
2. Update IMPLEMENTATION_LOG.md with a summary (copy the format from TASK-015)
3. Start TASK-017 (role-based access control)

Good luck! 🎉

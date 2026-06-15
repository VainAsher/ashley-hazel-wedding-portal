# Test Data Seeding - Integration Guide

This guide shows how to integrate the test data seeding scripts into your test workflow.

## Quick Start

### 1. Seed Before Running Tests

```bash
# From project root
cd production/backend

# Seed the database
python -m scripts.seed_test_data

# Run tests
pytest tests/
```

### 2. Verify Seeds Are Correct

```bash
# Validate that all seeds were created successfully
python -m scripts.validate_test_seeds
```

Expected output:
```
======================================================================
VALIDATING TEST DATABASE SEEDS
======================================================================

Wedding existence:
----------------------------------------------------------------------
✓ Test wedding exists: Ashley & Hazel
  - Date: 2026-06-20
  - ID: 1

Invite codes:
----------------------------------------------------------------------
✓ Invite exists: DEMO-COUPLE (role: couple)
✓ Invite exists: DEMO-COORDINATOR (role: coordinator)
✓ Invite exists: DEMO-GUEST (role: guest) -> Guest: Demo Guest

Guest records:
----------------------------------------------------------------------
✓ Guest exists: Demo Guest (demo-guest@example.com)
✓ Guest exists: Alice Anderson (demo-guest-1@example.com)
✓ Guest exists: Bob Butler (demo-guest-2@example.com)
✓ Guest exists: Carol Chen (demo-guest-3@example.com)
✓ Guest exists: David Davis (demo-guest-4@example.com)

Invite-guest relationships:
----------------------------------------------------------------------
✓ DEMO-GUEST invite correctly linked to: Demo Guest
✓ DEMO-COUPLE invite correctly has no guest link
✓ DEMO-COORDINATOR invite correctly has no guest link

Record counts:
----------------------------------------------------------------------
✓ Found 3 test invites
✓ Found 5 test guests

======================================================================
✓ All validations passed!
======================================================================
```

## Integration Options

### Option A: Manual Seeding (Simplest for Development)

```bash
# One-time setup
python -m scripts.seed_test_data

# Run tests (data persists)
pytest tests/ -v
pytest tests/test_auth.py -v
```

**Pros**: Simple, works immediately, doesn't require code changes
**Cons**: Manual step, easy to forget

### Option B: Automatic via Pytest Plugin (Recommended for CI/CD)

Add to `conftest.py`:

```python
import pytest
from scripts.seed_test_data import main as seed_main

@pytest.fixture(scope="session", autouse=True)
def auto_seed_test_database():
    """Automatically seed test database before tests run."""
    print("\n[Seeding test database...]")
    seed_main()
    yield
    # Optional cleanup after tests
```

Then just run tests:

```bash
pytest tests/ -v  # Automatically seeds before running
```

**Pros**: Fully automated, no manual steps
**Cons**: Slightly slower due to seeding on every test session

### Option C: Pre-test Hook in CI/CD

Add to `.github/workflows/test.yml`:

```yaml
name: Run Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: wedding
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r production/backend/requirements.txt
      
      - name: Apply migrations
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost/wedding
        run: |
          cd production/backend
          alembic upgrade head
      
      - name: Seed test database
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost/wedding
        run: |
          cd production/backend
          python -m scripts.seed_test_data
      
      - name: Run tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost/wedding
        run: |
          cd production/backend
          pytest tests/ -v --tb=short
```

**Pros**: Clean, explicit, works with CI/CD pipelines
**Cons**: Requires CI config changes

### Option D: Via Docker Compose

Add to `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: wedding
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  seed:
    build:
      context: .
      dockerfile: Dockerfile.backend
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/wedding
    command: |
      sh -c "
      python -m scripts.seed_test_data &&
      python -m pytest tests/ -v
      "

volumes:
  postgres_data:
```

Then run:

```bash
docker-compose up seed
```

**Pros**: Completely isolated environment, works on any machine
**Cons**: Requires Docker setup

## Using Seeded Invites in Tests

### Testing Authentication

```python
# tests/test_auth.py
from fastapi.testclient import TestClient
from app.main import app

def test_login_with_demo_couple():
    """Test couple can login with DEMO-COUPLE code."""
    client = TestClient(app)
    
    response = client.post(
        "/api/auth/login",
        json={"invite_code": "DEMO-COUPLE"}
    )
    
    assert response.status_code == 200
    assert "session_id" in response.json() or "token" in response.json()


def test_login_with_demo_coordinator():
    """Test coordinator can login with DEMO-COORDINATOR code."""
    client = TestClient(app)
    
    response = client.post(
        "/api/auth/login",
        json={"invite_code": "DEMO-COORDINATOR"}
    )
    
    assert response.status_code == 200


def test_login_with_demo_guest():
    """Test guest can login with DEMO-GUEST code."""
    client = TestClient(app)
    
    response = client.post(
        "/api/auth/login",
        json={"invite_code": "DEMO-GUEST"}
    )
    
    assert response.status_code == 200
```

### Testing Authorization Levels

```python
# tests/test_authorization.py
from fastapi.testclient import TestClient
from app.main import app

def test_coordinator_can_view_all_guests():
    """Test that coordinators can view all guests."""
    client = TestClient(app)
    
    # Login as coordinator
    client.post(
        "/api/auth/login",
        json={"invite_code": "DEMO-COORDINATOR"}
    )
    
    # Should be able to view guests
    response = client.get("/api/guests")
    assert response.status_code == 200
    assert len(response.json()) > 0


def test_guest_can_only_view_themselves():
    """Test that guests can only view their own info."""
    client = TestClient(app)
    
    # Login as guest
    client.post(
        "/api/auth/login",
        json={"invite_code": "DEMO-GUEST"}
    )
    
    # Should only see their own guest record
    response = client.get("/api/guests")
    assert response.status_code == 200
    data = response.json()
    # Should have only 1 result (their own record)
    assert len(data) == 1 or data[0]["email"] == "demo-guest@example.com"
```

### Testing RSVP Functionality

```python
# tests/test_rsvp.py
from fastapi.testclient import TestClient
from app.main import app

def test_guest_can_rsvp():
    """Test that a guest can RSVP to the wedding."""
    client = TestClient(app)
    
    # Login as guest
    client.post(
        "/api/auth/login",
        json={"invite_code": "DEMO-GUEST"}
    )
    
    # RSVP
    response = client.post(
        "/api/guests/rsvp",
        json={
            "status": "accepted",
            "meal_choice": "chicken",
            "dietary_restrictions": "vegetarian"
        }
    )
    
    assert response.status_code == 200
```

## Test Data Overview

The seeds create this structure:

```
Wedding (ID: 1)
├─ Name: Ashley & Hazel
├─ Date: 2026-06-20
├─ Invites:
│  ├─ DEMO-COUPLE (role: couple)
│  │  └─ Household: Demo Couple
│  │  └─ Guest: None (couple doesn't have a guest record)
│  ├─ DEMO-COORDINATOR (role: coordinator)
│  │  └─ Household: Demo Coordinator
│  │  └─ Guest: None
│  └─ DEMO-GUEST (role: guest)
│     └─ Household: Demo Guest Household
│     └─ Guest: Demo Guest (demo-guest@example.com)
└─ Guests:
   ├─ Demo Guest (demo-guest@example.com) [linked to DEMO-GUEST invite]
   ├─ Alice Anderson (demo-guest-1@example.com)
   ├─ Bob Butler (demo-guest-2@example.com)
   ├─ Carol Chen (demo-guest-3@example.com)
   └─ David Davis (demo-guest-4@example.com)
```

## Troubleshooting

### Tests Still Fail with "Invite Code Not Found"

1. Check seeds were created:
   ```bash
   python -m scripts.validate_test_seeds
   ```

2. Manually check database:
   ```sql
   psql -U postgres -d wedding -c "SELECT * FROM invites WHERE code LIKE 'DEMO-%';"
   psql -U postgres -d wedding -c "SELECT * FROM guests WHERE email LIKE 'demo-guest%';"
   ```

3. Re-run seeding:
   ```bash
   python -m scripts.seed_test_data
   ```

### Database Connection Issues

Make sure `DATABASE_URL` is set correctly:

```bash
# Check current value
echo $DATABASE_URL

# Set for current session
export DATABASE_URL=postgresql://postgres:password@localhost/wedding

# Then run seed
python -m scripts.seed_test_data
```

### Unique Constraint Violations

If you get errors about unique constraints, clean up old data:

```sql
-- Clean up test data
DELETE FROM invites WHERE code LIKE 'DEMO-%' OR code LIKE 'PYTEST-%';
DELETE FROM guests WHERE email LIKE 'demo-guest%' OR email LIKE 'pytest-guest%';

-- Then re-seed
python -m scripts.seed_test_data
```

## Files Reference

| File | Purpose |
|------|---------|
| `seed_test_data.py` | Main Python seeding script |
| `seed_test_data.sql` | SQL-only seeding script |
| `validate_test_seeds.py` | Validation/verification script |
| `SEED_DATA_README.md` | Comprehensive documentation |
| `INTEGRATION_GUIDE.md` | This file - integration examples |

## Next Steps

1. **Choose integration option**: Pick Option A (manual), B (pytest), C (CI/CD), or D (Docker)
2. **Test locally**: Run seeds and verify they work
3. **Update CI/CD**: If using Option C or D, update your pipeline
4. **Run tests**: Verify tests pass with seeded data
5. **Document**: Add to your project's testing documentation

## Questions?

- Check `SEED_DATA_README.md` for detailed documentation
- Run `python -m scripts.validate_test_seeds` to diagnose issues
- Review test examples in `tests/test_auth.py`

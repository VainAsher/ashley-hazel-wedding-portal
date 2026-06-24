# Test Database Seeding

This directory contains scripts to seed the test database with valid invites and guests, enabling authentication testing.

## Two Seeding Paths

There are two separate seeders. They are not interchangeable:

1. **`scripts/seed_test_data.py`** — the **idempotent**, SQLAlchemy-based seeder.
   Safe to run repeatedly; it checks for existing rows before inserting and
   never deletes. Use this for manual development seeding and CI.
2. **`production/database/migrations/008_seed_test_data.sql`** — a
   **DESTRUCTIVE** SQL seed that runs
   `DELETE FROM invites/guests/users/wedding_party WHERE wedding_id = 1` and then
   re-inserts the demo data. It is intended for **test/CI only** and is **NOT for
   production**, because it will overwrite real `wedding_id = 1` data. Note that
   it lives in the numbered-migrations directory and is therefore picked up by
   `deploy.sh`'s `[0-9]*.sql` glob — see `migrations/README.md` for the risk and
   the fencing requirement before any real production wedding DB.

Both paths produce the same logical dataset (wedding ID 1 "Ashley & Hazel",
three `DEMO-*` invites, five demo guests).

## Problem Solved

Tests were failing with authentication errors because they tried to login with invite codes that didn't exist in the test database. These scripts populate the database with test data before tests run.

## Scripts

### 1. Python Seed Script (`seed_test_data.py`)

**Recommended for development and CI/CD**

The Python script provides:
- SQLAlchemy-based seeding (matches production code patterns)
- Idempotent operations (safe to run multiple times)
- Better error handling and logging
- Integration with project's database configuration

#### Usage

```bash
# Run from project root
python -m scripts.seed_test_data

# Or directly
cd production/backend
python scripts/seed_test_data.py
```

#### What it creates

- **Test Wedding**: "Ashley & Hazel" (ID: 1, Date: 2026-06-20)
- **Invite Codes**:
  - `DEMO-COUPLE` - Couple login (no guest association)
  - `DEMO-COORDINATOR` - Coordinator login (no guest association)
  - `DEMO-GUEST` - Guest login (linked to guest record)
- **Test Guests**:
  - Demo Guest (associated with DEMO-GUEST invite)
  - Alice Anderson (demo-guest-1@example.com)
  - Bob Butler (demo-guest-2@example.com)
  - Carol Chen (demo-guest-3@example.com)
  - David Davis (demo-guest-4@example.com)

#### Example Output

```
======================================================================
SEEDING TEST DATABASE WITH VALID INVITES AND GUESTS
======================================================================

Step 1: Ensuring test wedding exists...
✓ Test wedding already exists: Ashley & Hazel (ID: 1)

Step 2: Seeding invite codes...
✓ Couple invite already exists: DEMO-COUPLE
✓ Coordinator invite already exists: DEMO-COORDINATOR
✓ Guest invite already exists: DEMO-GUEST -> Guest ID 1

Step 3: Seeding additional test guests...
✓ Guest already exists: Alice Anderson (demo-guest-1@example.com)
✓ Guest already exists: Bob Butler (demo-guest-2@example.com)
...

Step 4: Verifying seeded data...
Total invites: 3
  - DEMO-COUPLE (couple)
  - DEMO-COORDINATOR (coordinator)
  - DEMO-GUEST (guest) (Guest: Demo Guest)

Total guests: 5
  - Demo Guest (demo-guest@example.com)
  - Alice Anderson (demo-guest-1@example.com)
  ...

======================================================================
✓ TEST DATABASE SEEDING COMPLETE
======================================================================

Test Invite Codes:
  Couple:      DEMO-COUPLE
  Coordinator: DEMO-COORDINATOR
  Guest:       DEMO-GUEST
```

### 2. Validation Script (`validate_test_seeds.py`)

After seeding, confirm the expected dataset exists:

```bash
cd production/backend
python -m scripts.validate_test_seeds
```

It checks that wedding ID 1 ("Ashley & Hazel") exists, that the three `DEMO-*`
invites are present with the right roles and guest links, that the five demo
guests exist, and that the record counts (3 invites, 5 guests) match. See
`INTEGRATION_GUIDE.md` for example output.

### 3. SQL Seed Script (`seed_test_data.sql`)

**Useful for direct database operations and documentation**

This is the **idempotent** SQL seeder at `production/database/seed_test_data.sql`
(`INSERT ... ON CONFLICT`, no deletes). It is distinct from the destructive
`migrations/008_seed_test_data.sql` described above. The SQL script provides:
- Pure SQL operations (no Python dependencies)
- Explicit database state visibility
- Useful for understanding schema relationships

#### Usage

```bash
# Login to PostgreSQL directly
psql -U postgres -d wedding < production/database/seed_test_data.sql

# Or using pg_restore
PGPASSWORD=your_password psql -h localhost -U postgres -d wedding < production/database/seed_test_data.sql
```

## Using Test Invites in Tests

### In Unit Tests

```python
from sqlalchemy.orm import Session
from app.db.models import Invite

# Get existing invite
def test_login_with_demo_invite(client: TestClient, db_session: Session):
    # Create invite (or use pre-seeded one)
    invite = Invite(
        code="DEMO-COUPLE",
        wedding_id=1,
        household_name="Demo Couple",
        role="couple",
    )
    db_session.add(invite)
    db_session.commit()

    # Login
    response = client.post("/api/auth/login", json={"invite_code": "DEMO-COUPLE"})
    assert response.status_code == 200
```

### In Integration Tests

```python
def test_guest_can_rsvp(client: TestClient, db_session: Session):
    # Use pre-seeded DEMO-GUEST code
    response = client.post("/api/auth/login", json={"invite_code": "DEMO-GUEST"})
    assert response.status_code == 200

    # Now make authenticated requests
    response = client.post("/api/guests/123/rsvp", json={"status": "accepted"})
    assert response.status_code == 200
```

### Using the `authorized_client` Fixture

The `conftest.py` already has fixtures that create temporary invites:

```python
def test_coordinator_actions(authorized_client: TestClient):
    # authorized_client is already logged in as coordinator
    response = authorized_client.get("/api/guests")
    assert response.status_code == 200
```

## Database Relationships

The seeding scripts respect these relationships:

```
Wedding (ID: 1)
├── Invites
│   ├── DEMO-COUPLE (role: couple, no guest)
│   ├── DEMO-COORDINATOR (role: coordinator, no guest)
│   └── DEMO-GUEST (role: guest, links to Guest)
└── Guests
    ├── Demo Guest (demo-guest@example.com) [linked to DEMO-GUEST invite]
    ├── Alice Anderson (demo-guest-1@example.com)
    ├── Bob Butler (demo-guest-2@example.com)
    ├── Carol Chen (demo-guest-3@example.com)
    └── David Davis (demo-guest-4@example.com)
```

## Running Before Tests

### Option 1: Manual Seeding (Development)

```bash
# Ensure database is created and migrations applied
python -m scripts.seed_test_data

# Then run tests
pytest production/backend/tests/
```

### Option 2: Automatic in pytest (CI/CD)

Add to `conftest.py`:

```python
@pytest.fixture(scope="session", autouse=True)
def seed_test_database():
    """Auto-seed test database before tests run."""
    from scripts.seed_test_data import main as seed_main
    seed_main()
```

### Option 3: GitHub Actions

Add to `.github/workflows/test.yml`:

```yaml
- name: Seed test database
  run: |
    cd production/backend
    python -m scripts.seed_test_data
    
- name: Run tests
  run: pytest production/backend/tests/
```

## Idempotency

Both scripts are **idempotent** - they can be run multiple times safely:

- **Python script**: Uses SQLAlchemy `.filter().first()` to check existence before creating
- **SQL script**: Uses `INSERT ... ON CONFLICT DO NOTHING` and `ON CONFLICT DO UPDATE`

No data is duplicated or lost when running multiple times.

## Cleaning Up Test Data

To remove seeded test data:

```bash
# Remove via SQL
DELETE FROM invites WHERE wedding_id = 1 AND code LIKE 'DEMO-%';
DELETE FROM guests WHERE wedding_id = 1 AND email LIKE 'demo-guest%';

# Or from Python
from app.db.database import SessionLocal
from app.db.models import Invite, Guest

session = SessionLocal()
session.query(Invite).filter(Invite.code.like('DEMO-%')).delete()
session.query(Guest).filter(Guest.email.like('demo-guest%')).delete()
session.commit()
session.close()
```

## Configuration

The scripts use these environment variables:

- `DATABASE_URL`: PostgreSQL connection string
  - Default: `postgresql://localhost/wedding`
  - Example: `postgresql://user:pass@localhost:5432/wedding_test`

Example usage with custom database:

```bash
DATABASE_URL=postgresql://postgres:secret@localhost/wedding_test \
  python -m scripts.seed_test_data
```

## Troubleshooting

### Connection Errors

```
sqlalchemy.exc.OperationalError: (psycopg2.OperationalError) could not connect to server
```

**Solution**: Ensure PostgreSQL is running and `DATABASE_URL` is correct

```bash
export DATABASE_URL=postgresql://postgres:@localhost/wedding
python -m scripts.seed_test_data
```

### Unique Constraint Violations

If you get `IntegrityError` about unique constraints, the data may already exist. The script checks for this, but you can clean up manually:

```sql
DELETE FROM invites WHERE code IN ('DEMO-COUPLE', 'DEMO-COORDINATOR', 'DEMO-GUEST');
DELETE FROM guests WHERE email LIKE 'demo-guest%';
```

### Missing Dependencies

```
ModuleNotFoundError: No module named 'app'
```

**Solution**: Run from the project root or add to `PYTHONPATH`:

```bash
cd production/backend
python scripts/seed_test_data.py

# Or
export PYTHONPATH=production/backend:$PYTHONPATH
python production/backend/scripts/seed_test_data.py
```

## Testing the Seeds

Verify your seeds work:

```python
# test_seeds.py
from app.db.database import SessionLocal
from app.db.models import Invite, Guest

def test_demo_invites_exist():
    session = SessionLocal()
    try:
        couple = session.query(Invite).filter(Invite.code == "DEMO-COUPLE").first()
        coordinator = session.query(Invite).filter(Invite.code == "DEMO-COORDINATOR").first()
        guest = session.query(Invite).filter(Invite.code == "DEMO-GUEST").first()

        assert couple is not None, "DEMO-COUPLE invite not found"
        assert coordinator is not None, "DEMO-COORDINATOR invite not found"
        assert guest is not None, "DEMO-GUEST invite not found"
        assert guest.guest_id is not None, "DEMO-GUEST invite not linked to guest"

        # Test login
        response = client.post("/api/auth/login", json={"invite_code": "DEMO-COUPLE"})
        assert response.status_code == 200
    finally:
        session.close()
```

## References

- **Models**: `production/backend/app/db/models.py`
- **Schema**: `production/database/schema.sql`
- **Auth Tests**: `production/backend/tests/test_auth.py`
- **Test Fixtures**: `production/backend/tests/conftest.py`

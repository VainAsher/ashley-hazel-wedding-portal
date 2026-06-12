# Backend Test Fixtures

Shared pytest fixtures are exposed from `tests/conftest.py`.

## Common Fixtures

- `client`: FastAPI `TestClient` for API and middleware tests.
- `db_session`: SQLAlchemy session using the configured test database.
- `clean_test_guests`: removes records whose email starts with `pytest-guest`.
- `sample_guest_payload`: API-ready guest payload with a unique email.
- `sample_vendor_payload`: vendor-shaped sample data for future vendor tests.
- `sample_budget_payload`: budget-shaped sample data for future budget tests.
- `sample_guest`: persisted `Guest` ORM row.
- `multiple_guests`: three persisted `Guest` ORM rows with varied RSVP statuses.
- `create_guest_via_api`: helper that POSTs a guest and returns the JSON response.

## Usage

Prefer fixtures over local helper functions:

```python
def test_get_guest(client, create_guest_via_api):
    guest = create_guest_via_api()

    response = client.get(f"/api/guests/{guest['id']}")

    assert response.status_code == 200
```

Fixtures that create `pytest-guest...` rows automatically depend on
`clean_test_guests`, so they clean up before and after each test.

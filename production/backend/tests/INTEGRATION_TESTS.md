# Backend Integration Test Patterns

Integration tests live alongside unit tests and use the shared fixtures from
`tests/conftest.py`.

## What To Cover

- Full API request/response workflows.
- Database persistence after API create and update operations.
- End-to-end error handling from validation, missing records, and constraints.
- Pagination or query behavior exposed by an API endpoint.
- Concurrent access when behavior depends on database commits.

## Fixture Pattern

Use `client` for API calls and `db_session` to verify persisted state:

```python
def test_guest_update_persists(client, db_session, guest_payload_factory):
    response = client.post("/api/guests", json=guest_payload_factory())
    guest_id = response.json()["id"]

    client.put(f"/api/guests/{guest_id}", json={"notes": "Updated"})

    db_session.expire_all()
    assert db_session.get(Guest, guest_id).notes == "Updated"
```

For guest tests, apply `clean_test_guests` so rows whose email starts with
`pytest-guest` are removed before and after each test.

## Local And CI Behavior

These tests require a PostgreSQL database with the migrations applied and a
seed wedding row. The GitHub Actions backend job provisions that database; the
deployment VM uses its existing backend `.env`.

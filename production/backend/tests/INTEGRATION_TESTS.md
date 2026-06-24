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

Protected endpoints (guests, vendors, budget, etc.) require an authenticated
session, so integration tests use **`authorized_client`** — a `TestClient`
already logged in as a coordinator — for API calls, and `db_session` to verify
persisted state. Use the unauthenticated `client` only when testing auth
behavior itself (login, 401s, etc.).

```python
def test_guest_update_persists(authorized_client, db_session, guest_payload_factory):
    response = authorized_client.post("/api/guests", json=guest_payload_factory())
    guest_id = response.json()["id"]

    authorized_client.put(f"/api/guests/{guest_id}", json={"notes": "Updated"})

    db_session.expire_all()
    assert db_session.get(Guest, guest_id).notes == "Updated"
```

`guest_payload_factory` returns the payload builder, so call it (with optional
overrides) to produce each request body. The default payloads use the
`pytest-guest` email prefix.

For guest tests, apply `clean_test_guests` (or use a fixture that already depends
on it, such as `create_guest_via_api`) so rows whose email starts with
`pytest-guest` are removed before and after each test. `authorized_client` also
cleans up its own `PYTEST-FIXTURE-%` auth invites on teardown.

## Local And CI Behavior

These tests require a PostgreSQL database with the migrations applied and a
seed wedding row. The GitHub Actions backend job provisions that database; the
deployment VM uses its existing backend `.env`.

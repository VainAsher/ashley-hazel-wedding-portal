# Backend Test Fixtures

Shared pytest fixtures are exposed from `tests/conftest.py`. The payload builders
they wrap live in `tests/fixtures/guests.py`.

## Core Fixtures

- `client`: FastAPI `TestClient` for API and middleware tests (unauthenticated).
- `db_session`: SQLAlchemy session using the configured test database.
- `wedding_id`: the test wedding id (`TEST_WEDDING_ID`, currently `1`).

## Authenticated Clients / Sessions

These create an `Invite` row, log in via `POST /api/auth/login`, and return an
authenticated `TestClient`:

- `authorized_client`: client authenticated as a **coordinator** (invite code
  prefix `PYTEST-FIXTURE-COORD-`). Logs out and removes its
  `PYTEST-FIXTURE-%` invites on teardown. **Use this for integration tests that
  hit protected endpoints.**
- `coordinator_session`: client authenticated as a coordinator (invite code
  prefix `PYTEST-COORD-`). Lighter weight; does not auto-clean its invite.
- `guest_session`: client authenticated as a **guest**. Creates a guest row
  (email prefixed `pytest-guest-`) plus a `PYTEST-GUEST-` invite linked to it,
  then logs in.

## Payload Builders & Factory

- `sample_guest_payload`: API-ready guest payload with a unique
  `pytest-guest-...` email.
- `sample_vendor_payload`: vendor-shaped sample data.
- `sample_budget_payload`: budget-shaped sample data.
- `guest_payload_factory`: returns the `guest_payload(**overrides)` builder
  itself, so a test can mint multiple customized payloads:

  ```python
  def test_two_guests(authorized_client, guest_payload_factory):
      a = authorized_client.post("/api/guests", json=guest_payload_factory(name="A"))
      b = authorized_client.post("/api/guests", json=guest_payload_factory(name="B"))
      assert a.status_code == 201 and b.status_code == 201
  ```

  `guest_payload(**overrides)` defaults `wedding_id`, `name`, a unique
  `pytest-guest-...@example.com` email, `phone`, `relationship`, `rsvp_status`,
  `meal_choice`, and `dietary_notes`; any keyword override replaces a default.

## Persisted ORM Rows

- `sample_guest`: one persisted `Guest` ORM row (depends on `clean_test_guests`).
- `multiple_guests`: three persisted `Guest` rows with varied RSVP statuses
  (depends on `clean_test_guests`).

## API Helper

- `create_guest_via_api`: helper that POSTs a guest through `authorized_client`
  and returns the JSON response. Depends on `clean_test_guests`.

## Cleanup Fixtures (email-prefix convention)

- `clean_test_guests`: removes every `Guest` whose `email` starts with
  `pytest-guest` (the `TEST_EMAIL_PREFIX`), both **before and after** the test.

Any test that creates guests should use the `pytest-guest` email prefix (the
payload builders do this automatically) so `clean_test_guests` can reclaim them.
The `authorized_client` fixture separately removes its `PYTEST-FIXTURE-%` auth
invites on teardown.

## Usage

Prefer fixtures over local helper functions. For protected endpoints, use the
authenticated `authorized_client`:

```python
def test_get_guest(authorized_client, create_guest_via_api):
    guest = create_guest_via_api()

    response = authorized_client.get(f"/api/guests/{guest['id']}")

    assert response.status_code == 200
```

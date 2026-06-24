# Browser test fixtures

Helpers shared by the Playwright specs in `../`.

## How the specs are written

Each spec uses **plain Playwright `test`** with **inline `page.route(...)` mocks**
for the API endpoints it needs (typically `GET /api/auth/me` to set the
authenticated user/role, plus the data endpoints under test), and the helpers in
`page-cleanup.ts` for isolation and console-error tracking. There is no shared
authentication fixture — auth is mocked per-spec via `page.route`.

> A previous `auth.fixture.ts` fixture library existed but was never adopted by
> any spec; it (and its `auth.fixture.example.ts` template) were removed. If a
> shared auth fixture is wanted later, reintroduce it and actually wire the specs
> to it.

## `page-cleanup.ts`

| Export | Purpose |
| --- | --- |
| `cleanupPageState(page)` | Unroute all handlers and clear cookies + local/session storage between tests. |
| `initializeErrorTracking(page)` | Attach `console` error + `pageerror` listeners to collect browser errors. |
| `getBrowserErrors(page)` | Return the errors collected so far. |
| `filterIgnorableErrors(errors)` | Drop expected noise (401/400 responses, `net::ERR_FAILED`, clipboard-permission warnings). |

Typical usage: call `initializeErrorTracking` at the start of a spec, assert on
`filterIgnorableErrors(getBrowserErrors(page))` where you expect a clean console,
and `cleanupPageState` between cases.

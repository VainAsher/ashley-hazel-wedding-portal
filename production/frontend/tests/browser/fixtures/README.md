# Browser Test Fixtures

Shared utilities for the wedding portal Playwright browser tests. There are two
real modules here plus one unused template:

- **`page-cleanup.ts`** — imported by **every** spec; provides per-test state
  reset and console/page error tracking.
- **`auth.fixture.ts`** — a `Playwright` fixture library
  (`authenticatedTest` / `testWithAuth`) with pre-authenticated pages and auth
  mock helpers. **Available but not yet used by any spec.**
- **`auth.fixture.example.ts`** — an unused example file demonstrating the
  `auth.fixture.ts` API.

> **How the specs actually work today (V1.0-rc1):** each `*.spec.ts` uses the
> plain Playwright `test`, declares any user shape locally, mocks endpoints with
> inline `page.route(...)` calls, and uses the `page-cleanup.ts` helpers for
> isolation and error assertions. The `authenticatedTest` / `testWithAuth`
> fixtures are an available alternative that has not been adopted.

---

## `page-cleanup.ts` (used by the specs)

### `cleanupPageState(page)`
Resets state between tests: unroutes all handlers (`page.unroute('**/*')`),
clears cookies and local/session storage, and deletes the tracked
`browserErrors`. Call it in `beforeEach`.

### `initializeErrorTracking(page)`
Attaches `console` (error-level) and `pageerror` listeners and stores the
collected messages on the page. Returns the backing array. Call it in
`beforeEach`, after `cleanupPageState`.

### `getBrowserErrors(page)`
Returns the array of tracked console/page error messages.

### `filterIgnorableErrors(errors, ignoredPatterns?)`
Filters out expected noise. Default ignore list:
- `the server responded with a status of 401`
- `the server responded with a status of 400`
- `net::ERR_FAILED`
- `Write permission denied` (clipboard API unavailable in headless)

Pass extra patterns to ignore per spec.

### Typical spec usage

```typescript
import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)
})

test.afterEach(async ({ page }) => {
  const unexpected = filterIgnorableErrors(getBrowserErrors(page))
  expect(unexpected).toEqual([])
})

test('authenticated couple lands on admin', async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: 30, name: 'Ashley & Hazel', role: 'couple',
        wedding_id: 1, invite_id: 40, guest_id: null,
      }),
    }),
  )
  await page.goto('/')
  await expect(page).toHaveURL(/\/admin$/)
})
```

See `auth-routing.spec.ts` and `invite-management.spec.ts` for full examples.

---

## `auth.fixture.ts` (available, not yet adopted)

A `base.extend` fixture library that mocks `/api/auth/me` (and, for the login
helpers, `/api/auth/login`) so a spec can get a logged-in page without writing
the auth mock by hand. It calls `cleanupPageState` + `initializeErrorTracking`
internally, so you do not need your own `beforeEach` for those when using it.

> Note: the fixtures perform cleanup and error *tracking* automatically, but they
> do **not** assert on errors in an `afterEach`. To check for unexpected errors,
> call `verifyNoUnexpectedErrors(page)` yourself at the end of a test.

### Pre-authenticated page fixtures (`authenticatedTest`)

| Fixture | User | Role |
|---------|------|------|
| `authenticatedCouplePage` | `testUsers.couple` | couple (admin) |
| `authenticatedGuestPage` | `testUsers.guest` | guest |
| `authenticatedCoordinatorPage` | `testUsers.coordinator` | coordinator |
| `authenticatedPage` | `testUsers.guest` | guest (alias of the guest page) |

```typescript
import { authenticatedTest } from './fixtures/auth.fixture'

authenticatedTest('admin page shows dashboard', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')
  await expect(authenticatedCouplePage.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
})
```

These fixtures only mock `/api/auth/me`. Pages that fetch other data still need
those endpoints mocked on the fixture page (`authenticatedCouplePage.route(...)`).

### `testWithAuth`

Base test with `cleanupPageState` + `initializeErrorTracking` wired in, but no
user pre-authenticated. Use it when you need custom mocks, a custom user, or to
exercise the login form.

### Helper functions

- `mockCurrentUser(page, user | null)` — mock `/api/auth/me`; pass `null` for a
  401 (unauthenticated) response.
- `mockLoginEndpoint(page, user)` — mock `/api/auth/login` and set a session cookie.
- `setupAuthentication(page, user)` — `mockLoginEndpoint` + `mockCurrentUser`.
- `preAuthenticateUser(page, user)` — mock `/api/auth/me` before navigation
  (fast path, no login UI).
- `authenticateWithInviteCode(page, code, user, { mockApi })` — drive the
  `/invite` form end to end; `mockApi: false` hits a real backend.
- `setupErrorTracking(page)` — manual error-listener attach (the fixtures already
  do this via `page-cleanup`).
- `verifyNoUnexpectedErrors(page, ignored?)` — assert no unexpected console/page
  errors. Default ignore list: 401, `net::ERR_FAILED`, clipboard permission.

### Types

- `AuthUser` — `{ id, name, role, wedding_id, invite_id, guest_id }` where
  `role` is `'couple' | 'coordinator' | 'guest'` and `guest_id` is `number | null`.
- `AuthFixtures` — the fixture interface used by `authenticatedTest`.

### `testUsers`

```typescript
testUsers.guest        // { id: 10, name: 'Test Guest',        role: 'guest',       wedding_id: 1, invite_id: 20, guest_id: 10 }
testUsers.couple       // { id: 30, name: 'Ashley & Hazel',    role: 'couple',      wedding_id: 1, invite_id: 40, guest_id: null }
testUsers.coordinator  // { id: 50, name: 'Event Coordinator', role: 'coordinator', wedding_id: 1, invite_id: 60, guest_id: 11 }
```

---

## Troubleshooting

### Tests get a 401 / unauthenticated redirect
- Mock `/api/auth/me` before `page.goto(...)`, or use a pre-authenticated fixture.

### Custom mocks not applied
- Register `page.route(...)` (or `<fixturePage>.route(...)`) **before** navigation.

### Unexpected error assertion fails in `afterEach`
- Add the expected message to the second argument of `filterIgnorableErrors`
  (inline pattern) or `verifyNoUnexpectedErrors` (fixture pattern).

### `Cannot find module`
- Import `page-cleanup` / `auth.fixture` from `./fixtures/...` relative to the
  spec in `tests/browser/`.

## See also

- `page-cleanup.ts` / `auth.fixture.ts` — implementations
- `auth.fixture.example.ts` — example patterns (unused template)
- `QUICK_REFERENCE.md` — fixture templates
- `MIGRATION_GUIDE.md` — optional migration sketch
- `../auth-routing.spec.ts`, `../invite-management.spec.ts` — real specs

# Migration Guide (Optional — Not Yet Applied)

> **Status:** This is a *proposal*, not a record of completed work. As of
> V1.0-rc1 **no spec has been migrated** onto the `auth.fixture.ts` fixtures.
> Every `*.spec.ts` still uses plain Playwright `test` with inline
> `page.route(...)` mocks plus the `page-cleanup.ts` helpers. Use this document
> only if you decide to adopt `authenticatedTest` / `testWithAuth` in a spec.

## Current state (for reference)

The specs share one pattern: import the helpers from `page-cleanup.ts`, reset
state in `beforeEach`, assert no unexpected errors in `afterEach`, and mock
endpoints inline. For example, `auth-routing.spec.ts` (~205 lines) defines a
local `AuthUser` type, a local `json()` helper, a local `mockCurrentUser()`, and
calls `cleanupPageState` / `initializeErrorTracking` / `filterIgnorableErrors` /
`getBrowserErrors`. `invite-management.spec.ts` (~594 lines) does the same with
additional invite/guest route mocks.

This pattern works and is consistent across the suite. Migration is **optional**
and mainly removes per-spec auth boilerplate when a spec only needs a logged-in
user and does not assert on the login request itself.

## What the fixtures can replace

`auth.fixture.ts` can take over the auth-only part of a spec:

- A local `AuthUser` type → import `type AuthUser` from the fixture.
- A local `mockCurrentUser()` that mocks `/api/auth/me` → handled by the
  pre-authenticated fixtures (`authenticatedCouplePage`, etc.).
- Local `cleanupPageState` / `initializeErrorTracking` wiring → built into both
  `authenticatedTest` and `testWithAuth`.

The fixtures do **not** replace domain endpoint mocks. A page that fetches
invites, guests, budget, events, etc. still needs those routes mocked inline.

## Migration sketch

### Step 1 — Choose a fixture

- Test just needs a logged-in user → `authenticatedTest` with the role-matched
  page (`authenticatedCouplePage` / `authenticatedGuestPage` /
  `authenticatedCoordinatorPage`).
- Test exercises the login form or needs a custom user → `testWithAuth` plus
  `authenticateWithInviteCode()` or `preAuthenticateUser()`.

### Step 2 — Replace imports

**Before:**
```typescript
import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'
```

**After (auth-only spec):**
```typescript
import { expect } from '@playwright/test'
import { authenticatedTest } from './fixtures/auth.fixture'
```

### Step 3 — Drop the auth boilerplate the fixture now owns

Remove only what the fixture provides: the local `AuthUser` type, a local
`mockCurrentUser()`/`/api/auth/me` mock, and the `beforeEach`/`afterEach` blocks
that call the `page-cleanup` helpers. **Keep** any domain route mocks — move them
inside the test body on the fixture page.

### Step 4 — Convert the test

**Before:**
```typescript
test('authenticated couple root traffic lands on admin', async ({ page }) => {
  await mockCurrentUser(page, coupleUser)
  await page.goto('/')
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
})
```

**After:**
```typescript
authenticatedTest('authenticated couple root traffic lands on admin', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/')
  await expect(authenticatedCouplePage).toHaveURL(/\/admin$/)
  await expect(authenticatedCouplePage.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
})
```

For specs with domain mocks, attach them to the fixture page inside the test:

```typescript
authenticatedTest('admin lists invites', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.route('**/api/invites*', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
  )
  await authenticatedCouplePage.goto('/admin')
})
```

### Step 5 — Login-flow tests

For the invite-form login flow, `testWithAuth` + `authenticateWithInviteCode()`
keeps error tracking while letting you intercept the login request:

```typescript
import { testWithAuth, authenticateWithInviteCode, testUsers } from './fixtures/auth.fixture'

testWithAuth('submits invite code and redirects to rsvp', async ({ page }) => {
  const requests: unknown[] = []
  await page.route('**/api/auth/login', async (route) => {
    requests.push(route.request().postDataJSON())
    await route.continue()
  })

  await authenticateWithInviteCode(page, 'demo-001', testUsers.guest, { mockApi: true })

  await expect(page).toHaveURL(/\/rsvp$/)
})
```

## Caveats before migrating

- `authenticatedTest` only mocks `/api/auth/me`; it does **not** mock
  `/api/auth/login` or any domain endpoint. Specs that assert on login requests
  should stay on `testWithAuth` or the current inline pattern.
- The pre-authenticated fixtures use the fixed `testUsers` (ids 10/30/50). If a
  spec asserts on a specific user id or name, either align it with `testUsers`
  or use `testWithAuth` + `preAuthenticateUser()` with a custom user.
- `verifyNoUnexpectedErrors` (in `auth.fixture.ts`) and `filterIgnorableErrors`
  (in `page-cleanup.ts`) have slightly different default ignore lists; check the
  expected errors for a spec before swapping.

## Validation after any migration

1. Run the suite: `npm run test:browser`
2. Confirm no new failures.
3. Spot-check that previously-mocked domain endpoints are still mocked.

## Rollback

```bash
git checkout HEAD -- tests/browser/   # revert spec changes
```

## See also

- `README.md` — utility reference
- `auth.fixture.example.ts` — example patterns for the fixtures

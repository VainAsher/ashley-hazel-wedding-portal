# Test Fixtures Documentation Index

This directory holds the shared test utilities for the wedding portal Playwright
browser tests (`production/frontend/tests/browser`).

## What actually exists here

There are two real, in-use utility modules plus one unused template:

| File | Lines | Status | Purpose |
|------|-------|--------|---------|
| `page-cleanup.ts` | ~80 | **In use by every spec** | Per-test state reset and console/page error tracking |
| `auth.fixture.ts` | ~248 | **Available, not yet adopted** | `authenticatedTest` / `testWithAuth` fixtures, `testUsers`, auth mock helpers |
| `auth.fixture.example.ts` | ~222 | **Unused template** | Example patterns for `auth.fixture.ts`; not run as part of the suite |

> **Reality check.** As of V1.0-rc1 the specs do **not** use the
> `authenticatedTest` / `testWithAuth` fixtures from `auth.fixture.ts`. Every
> `*.spec.ts` uses the plain Playwright `test` plus inline `page.route(...)`
> mocks, and imports the helpers from **`page-cleanup.ts`**
> (`cleanupPageState`, `initializeErrorTracking`, `filterIgnorableErrors`,
> `getBrowserErrors`). The `auth.fixture.ts` library is a ready-to-use
> alternative that has not been wired into the specs.

## Documentation files

### [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
Copy-paste templates and patterns for the `auth.fixture.ts` API. Useful if you
choose to adopt the fixtures in a new spec.

### [README.md](./README.md)
Reference documentation for the `auth.fixture.ts` API and the `page-cleanup.ts`
helpers, plus the actual inline-mock pattern the specs use today.

### [SETUP_GUIDE.md](./SETUP_GUIDE.md)
How the fixtures integrate with the existing Playwright config, and notes on the
optional enhancements that are **not** currently present in the repo.

### [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
**Optional / not yet applied.** Sketch of how a spec *could* be moved from the
inline-mock pattern onto `authenticatedTest`. No spec has been migrated; treat
this as a proposal, not a record of work done.

### INDEX.md
This file.

## Implementation files

### [auth.fixture.ts](./auth.fixture.ts)
Core fixture library. Exports:
- `authenticatedTest` with fixtures `authenticatedPage`, `authenticatedCouplePage`,
  `authenticatedGuestPage`, `authenticatedCoordinatorPage`
- `testWithAuth` (base test with cleanup + error tracking)
- `testUsers` (`guest`, `couple`, `coordinator`)
- Helpers: `mockCurrentUser`, `mockLoginEndpoint`, `setupAuthentication`,
  `authenticateWithInviteCode`, `preAuthenticateUser`, `setupErrorTracking`,
  `verifyNoUnexpectedErrors`
- Types: `AuthUser`, `AuthFixtures`

It imports `cleanupPageState` and `initializeErrorTracking` from `page-cleanup.ts`.

### [page-cleanup.ts](./page-cleanup.ts)
The helpers the specs actually import. Exports:
- `cleanupPageState(page)` — unroutes all handlers, clears cookies/storage, resets
  the `browserErrors` tracker.
- `initializeErrorTracking(page)` — attaches `console`/`pageerror` listeners and
  stores collected messages on the page.
- `getBrowserErrors(page)` — returns the tracked messages.
- `filterIgnorableErrors(errors, ignored?)` — drops expected noise (401/400,
  `net::ERR_FAILED`, clipboard permission).

### [auth.fixture.example.ts](./auth.fixture.example.ts)
A standalone template showing ten usage patterns for `auth.fixture.ts`. It is
**not** referenced by any spec and is not part of the run suite — keep it as a
reference only.

## Quick start (the pattern the specs use)

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
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ /* user */ }) }),
  )
  await page.goto('/')
  await expect(page).toHaveURL(/\/admin$/)
})
```

Run the suite:

```bash
npm run test:browser
```

## See also

- `auth-routing.spec.ts` — representative example of the inline-mock pattern.
- `invite-management.spec.ts` — larger example with multiple route mocks.

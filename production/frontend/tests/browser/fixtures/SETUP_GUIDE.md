# Setup & Integration Guide

This guide explains how the test utilities in this folder integrate with the
existing Playwright setup, and lists optional enhancements that are **not**
currently present in the repo.

## Current Setup (No Changes Required)

The utilities work with the existing Playwright configuration without
modifications:

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // ...
})
```

Tests use the `baseURL` for all navigation.

## What is in this folder

```
production/frontend/tests/browser/
├── fixtures/
│   ├── page-cleanup.ts          ← Helpers every spec imports (cleanup + error tracking)
│   ├── auth.fixture.ts          ← authenticatedTest / testWithAuth library (available, unused by specs)
│   ├── auth.fixture.example.ts  ← Unused example/template for auth.fixture.ts
│   ├── README.md
│   ├── QUICK_REFERENCE.md
│   ├── MIGRATION_GUIDE.md
│   ├── SETUP_GUIDE.md           ← This file
│   └── INDEX.md
├── auth-routing.spec.ts
├── invite-management.spec.ts
└── ... (other spec files)
```

> There is **no** `global-setup.ts`, `test-data.ts`, or `mock-helpers.ts` in the
> repo today. The sections below describe those as optional patterns you could
> add — they are not currently wired in.

## How the specs are structured today

Every spec uses plain Playwright `test`, declares a local `AuthUser` shape if it
needs one, mocks endpoints inline with `page.route(...)`, and relies on the
`page-cleanup.ts` helpers for isolation and error checking:

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
  const unexpected = filterIgnorableErrors(getBrowserErrors(page), [
    'the server responded with a status of 401',
  ])
  expect(unexpected).toEqual([])
})

test('example', async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ /* user */ }) }),
  )
  await page.goto('/admin')
})
```

## Running tests

```bash
# Run all browser tests
npm run test:browser

# Run a specific test file
npm run test:browser auth-routing

# Debug mode with inspector
npx playwright test --debug

# Headed mode
npx playwright test --headed
```

## Optional: adopting auth.fixture.ts

`auth.fixture.ts` provides pre-authenticated page fixtures so a spec does not
have to mock `/api/auth/me` by hand. It is fully implemented but **not used by
any spec yet**. To try it in a new spec:

```typescript
import { authenticatedTest } from './fixtures/auth.fixture'

authenticatedTest('admin shows dashboard', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')
})
```

Note: the pre-authenticated fixtures only mock `/api/auth/me`. Any page that
fetches additional data still needs those endpoints mocked inline, so most specs
will still call `page.route(...)` for domain endpoints.

## Optional (not present): project-specific fixtures

You could extend `authenticatedTest` for repeated navigation. This file does not
exist in the repo — it is an example only:

```typescript
// (example) fixtures/wedding-portal.fixture.ts
import { authenticatedTest } from './auth.fixture'
import { type Page } from '@playwright/test'

export const weddingPortalTest = authenticatedTest.extend<{ adminPage: Page }>({
  adminPage: async ({ authenticatedCouplePage }, use) => {
    await authenticatedCouplePage.goto('/admin')
    await authenticatedCouplePage.waitForLoadState('networkidle')
    await use(authenticatedCouplePage)
  },
})
```

## Optional (not present): global setup, shared test data, mock helpers

None of the following exist in the repo. They are listed as ideas if the suite
grows:

- **`tests/global-setup.ts`** — run once before all tests (seed/reset DB, prime
  caches). Would be wired via `globalSetup: './tests/global-setup.ts'` in
  `playwright.config.ts`.
- **`fixtures/test-data.ts`** — a central module of reusable invites/guests
  payloads. Today each spec defines its own inline data.
- **`fixtures/mock-helpers.ts`** — shared `mockInvitesList` / `mockGuestsList`
  style helpers. Today each spec writes its own `page.route(...)` handlers.

## Debugging & Troubleshooting

### Enable trace for failed tests

Already configured in `playwright.config.ts` (`trace: 'retain-on-failure'`).
View a trace with:

```bash
npx playwright show-trace trace.zip
```

### Common setup issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `Cannot find module './fixtures/page-cleanup'` | Wrong import path | Import from `./fixtures/page-cleanup` |
| Tests timeout | Dev server not running | Ensure the server is reachable at `baseURL` |
| Auth mock not applied | Route registered after navigation | Call `page.route(...)` before `page.goto(...)` |
| Cross-test state leak | Missing cleanup | Call `cleanupPageState(page)` in `beforeEach` |

## See also

- `README.md` — utility reference and patterns
- `QUICK_REFERENCE.md` — `auth.fixture.ts` templates
- `MIGRATION_GUIDE.md` — optional migration sketch onto the fixtures

# Setup & Integration Guide

This guide explains how the authentication fixtures integrate with your Playwright setup and optional configurations.

## Current Setup (No Changes Required)

The fixtures are designed to work with your **existing Playwright configuration** without any modifications:

```typescript
// playwright.config.ts (no changes needed)
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

The fixtures will automatically use this `baseURL` for all navigation.

## Project Structure

Ensure your test directory structure is:

```
production/
└── frontend/
    ├── playwright.config.ts
    ├── tests/
    │   └── browser/
    │       ├── fixtures/
    │       │   ├── auth.fixture.ts          ← Your fixture (copy here)
    │       │   ├── auth.fixture.example.ts  ← Examples
    │       │   ├── README.md                ← Full docs
    │       │   ├── QUICK_REFERENCE.md       ← Quick ref
    │       │   └── SETUP_GUIDE.md           ← This file
    │       ├── auth-routing.spec.ts
    │       ├── invite-management.spec.ts
    │       └── ... (other test files)
    ├── src/
    ├── package.json
    └── ...
```

## Installation Steps

### 1. Copy Fixture Files

```bash
# From project root
mkdir -p production/frontend/tests/browser/fixtures

# Copy the fixture file
cp auth.fixture.ts production/frontend/tests/browser/fixtures/
```

### 2. Start Using in Tests

```typescript
// production/frontend/tests/browser/my-test.spec.ts
import { authenticatedTest } from './fixtures/auth.fixture'

authenticatedTest('my test', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')
})
```

### 3. Run Tests

```bash
# Run all browser tests
npm run test:browser

# Run specific test file
npm run test:browser auth-routing

# Run in debug mode
npx playwright test --debug
```

## Optional: Custom Fixture Extensions

If you want to create project-specific fixtures, extend the base fixture:

### 1. Create a Project-Specific Fixture

**production/frontend/tests/browser/fixtures/wedding-portal.fixture.ts:**

```typescript
import { authenticatedTest, testUsers, type AuthUser } from './auth.fixture'
import { type Page } from '@playwright/test'

/**
 * Wedding portal specific fixtures with common setup
 */

export interface WeddingPortalFixtures {
  adminPage: Page
  guestPortalPage: Page
}

export const weddingPortalTest = authenticatedTest.extend<WeddingPortalFixtures>({
  adminPage: async ({ authenticatedCouplePage }, use) => {
    // Navigate to admin and ensure it's loaded
    await authenticatedCouplePage.goto('/admin')
    await authenticatedCouplePage.waitForLoadState('networkidle')
    
    // Provide the page at admin
    await use(authenticatedCouplePage)
  },

  guestPortalPage: async ({ authenticatedGuestPage }, use) => {
    // Navigate to guest portal
    await authenticatedGuestPage.goto('/rsvp')
    await authenticatedGuestPage.waitForLoadState('networkidle')
    
    await use(authenticatedGuestPage)
  },
})
```

### 2. Use Project-Specific Fixture

```typescript
import { weddingPortalTest } from './fixtures/wedding-portal.fixture'

weddingPortalTest('admin shows invites', async ({ adminPage }) => {
  // adminPage is already at /admin and loaded
  await expect(adminPage.getByRole('heading', { name: 'Invites' })).toBeVisible()
})
```

## Optional: Global Setup/Teardown

If you need setup that runs once per test session (not per test), you can add a global setup file:

### 1. Create Global Setup File

**production/frontend/tests/global-setup.ts:**

```typescript
import { chromium, type FullConfig } from '@playwright/test'

/**
 * Global setup runs once before all tests
 * Useful for: setting up test data, priming caches, etc.
 */
async function globalSetup(config: FullConfig) {
  // Example: Start test server with seeded database
  console.log('Setting up tests...')
  
  // You could:
  // - Reset test database
  // - Seed test data
  // - Prime caches
  // - Validate backend is running
}

export default globalSetup
```

### 2. Add to playwright.config.ts

```typescript
export default defineConfig({
  testDir: './tests/browser',
  globalSetup: './tests/global-setup.ts', // Add this
  // ...
})
```

## Optional: Shared Test Data

If you have complex test data (invites, guests), centralize it:

### 1. Create Test Data File

**production/frontend/tests/browser/fixtures/test-data.ts:**

```typescript
import { type AuthUser } from './auth.fixture'

export interface TestDataSet {
  users: Record<string, AuthUser>
  invites: any[]
  guests: any[]
}

export const testData = {
  users: {
    guest1: { id: 10, name: 'Test Guest 1', role: 'guest', ... },
    guest2: { id: 11, name: 'Test Guest 2', role: 'guest', ... },
    couple: { id: 30, name: 'Ashley & Hazel', role: 'couple', ... },
    coordinator: { id: 50, name: 'Coordinator', role: 'coordinator', ... },
  },
  
  invites: {
    guest1: { code: 'DEMO-001', role: 'guest', guest_id: 10 },
    guest2: { code: 'DEMO-002', role: 'guest', guest_id: 11 },
    couple: { code: 'DEMO-COUPLE', role: 'couple', guest_id: null },
  },
  
  guests: [
    { id: 10, name: 'Test Guest 1', email: 'guest1@test.com' },
    { id: 11, name: 'Test Guest 2', email: 'guest2@test.com' },
    { id: 12, name: 'Unlinked Guest', email: null },
  ],
}
```

### 2. Use in Tests

```typescript
import { authenticatedTest } from './fixtures/auth.fixture'
import { testData } from './fixtures/test-data'

authenticatedTest('use shared test data', async ({ authenticatedCouplePage }) => {
  // Access shared data
  const guest = testData.users.guest1
  const invite = testData.invites.guest1
  
  // Use in test...
})
```

## Optional: Custom Mock Helpers

Create centralized mock helpers:

### 1. Create Mock Helpers File

**production/frontend/tests/browser/fixtures/mock-helpers.ts:**

```typescript
import { type Page, type Route } from '@playwright/test'

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

export async function mockInvitesList(page: Page, invites: any[]) {
  await page.route('**/api/invites*', async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, invites)
    } else {
      await route.continue()
    }
  })
}

export async function mockGuestsList(page: Page, guests: any[]) {
  await page.route('**/api/guests*', async (route) => {
    await json(route, guests)
  })
}

export async function mockApiError(page: Page, endpoint: string, status = 500) {
  await page.route(`**${endpoint}`, async (route) => {
    await json(route, { detail: 'Server error' }, status)
  })
}
```

### 2. Use Mock Helpers

```typescript
import { testWithAuth, preAuthenticateUser, testUsers } from './fixtures/auth.fixture'
import { mockInvitesList, mockGuestsList } from './fixtures/mock-helpers'
import { testData } from './fixtures/test-data'

testWithAuth('admin with common mocks', async ({ page }) => {
  // Apply common mocks
  await mockInvitesList(page, testData.invites)
  await mockGuestsList(page, testData.guests)
  
  // Pre-authenticate
  await preAuthenticateUser(page, testUsers.couple)
  
  // Navigate and test
  await page.goto('/admin')
})
```

## Performance Optimization

### Reduce Fixture Overhead

The fixtures are lightweight, but if running many tests:

```typescript
// ✅ Good: Reuse fixture across multiple tests
authenticatedTest('test 1', async ({ authenticatedCouplePage }) => { ... })
authenticatedTest('test 2', async ({ authenticatedCouplePage }) => { ... })

// ❌ Avoid: Repetitive setup per test
testWithAuth('test 1', async ({ page }) => {
  await preAuthenticateUser(page, testUsers.couple)
  // ...
})
testWithAuth('test 2', async ({ page }) => {
  await preAuthenticateUser(page, testUsers.couple)
  // ...
})
```

### Parallel Execution

Playwright runs tests in parallel by default. Fixtures are created per-test, so no conflicts:

```bash
# Run tests in parallel (default)
npm run test:browser

# Run tests sequentially if needed
npx playwright test --workers=1
```

## Debugging & Troubleshooting

### View Fixture State

```typescript
authenticatedTest('debug fixture', async ({ authenticatedCouplePage }) => {
  // Check authentication
  const cookies = await authenticatedCouplePage.context().cookies()
  console.log('Cookies:', cookies)
  
  // Check user
  const response = await authenticatedCouplePage.evaluate(() => {
    return fetch('/api/auth/me').then(r => r.json())
  })
  console.log('Current user:', response)
})
```

### Enable Trace for Failed Tests

Already configured in `playwright.config.ts`:

```typescript
use: {
  trace: 'retain-on-failure', // Keeps trace for debugging
}
```

View trace:

```bash
npx playwright show-trace trace.zip
```

### Run in Headed Mode

```bash
# See browser actions in real time
npx playwright test --headed

# Debug mode with inspector
npx playwright test --debug
```

## Environment Variables

If you need to customize fixture behavior per environment:

### 1. Use Environment Variables

```typescript
// fixtures/auth.fixture.ts
const API_MOCK_ENABLED = process.env.AUTH_MOCK_ENABLED !== 'false'

export async function authenticateWithInviteCode(
  page: Page,
  inviteCode: string,
  user: AuthUser,
  options: { mockApi?: boolean } = { mockApi: API_MOCK_ENABLED },
) {
  // ...
}
```

### 2. Set in Test Run

```bash
# Run with real backend (no mocks)
AUTH_MOCK_ENABLED=false npm run test:browser

# Run with mocked APIs (default)
npm run test:browser
```

### 3. Or in playwright.config.ts

```typescript
export default defineConfig({
  testDir: './tests/browser',
  
  // Set environment variables for all tests
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`,
  },
  
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === 'true',
  },
})
```

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      
      - run: npx playwright install
      
      - run: npm run test:browser
      
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

### Environment Variables in CI

```yaml
jobs:
  test:
    env:
      PLAYWRIGHT_PORT: 3100
      AUTH_MOCK_ENABLED: 'true'
    
    steps:
      - run: npm run test:browser
```

## Next Steps

1. **Install the fixture:** Copy `auth.fixture.ts` to `tests/browser/fixtures/`
2. **Start migrating tests:** See `MIGRATION_GUIDE.md`
3. **Reference patterns:** See `QUICK_REFERENCE.md`
4. **Run tests:** `npm run test:browser`
5. **Optional enhancements:** Add custom fixtures, mock helpers, test data

## Troubleshooting Setup

| Issue | Cause | Solution |
|-------|-------|----------|
| `Cannot find fixtures` | Wrong import path | Ensure path is `./fixtures/auth.fixture` |
| `Module not found` | Missing fixture file | Check file is in `tests/browser/fixtures/` |
| `Incorrect type` | TypeScript confusion | Clear `.playwright` cache: `rm -rf .playwright` |
| `Tests timeout | Server not running | Ensure dev server is accessible at `baseURL` |
| `Auth mocks not working` | Route mocking too late | Call `page.route()` before `page.goto()` |

## Questions?

- See **README.md** for detailed documentation
- See **QUICK_REFERENCE.md** for common patterns
- Check **auth.fixture.example.ts** for comprehensive examples
- Review **MIGRATION_GUIDE.md** to refactor existing tests

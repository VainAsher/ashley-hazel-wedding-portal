# Authentication Test Fixtures

This directory contains reusable Playwright test fixtures for handling authentication in the wedding portal frontend tests.

## Overview

The `auth.fixture.ts` file provides:
- **Pre-configured authenticated pages** for different user roles
- **Manual authentication helpers** for custom test scenarios
- **Session management** with mock and real backend support
- **Error tracking** utilities for test validation

## Quick Start

### Using Pre-Authenticated Fixtures

The easiest way to test protected routes is to use the pre-configured fixtures:

```typescript
import { authenticatedTest } from './fixtures/auth.fixture'

authenticatedTest('admin page shows dashboard', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')
  await expect(authenticatedCouplePage.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
})
```

## Available Fixtures

### `authenticatedCouplePage`
Pre-authenticated Playwright Page for the couple user (admin role).

```typescript
authenticatedTest('couple can access admin', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')
})
```

### `authenticatedGuestPage`
Pre-authenticated Playwright Page for a guest user.

```typescript
authenticatedTest('guest sees RSVP form', async ({ authenticatedGuestPage }) => {
  await authenticatedGuestPage.goto('/rsvp')
})
```

### `authenticatedCoordinatorPage`
Pre-authenticated Playwright Page for a coordinator user.

```typescript
authenticatedTest('coordinator can manage guests', async ({ authenticatedCoordinatorPage }) => {
  await authenticatedCoordinatorPage.goto('/admin/guests')
})
```

### `authenticatedPage`
Pre-authenticated Playwright Page for a generic guest user (same as `authenticatedGuestPage`).

## Manual Authentication Helpers

For advanced scenarios where you need custom mocks or multiple users:

### `authenticateWithInviteCode()`

Simulate the full login flow with an invite code:

```typescript
import {
  testWithAuth,
  authenticateWithInviteCode,
  testUsers,
} from './fixtures/auth.fixture'

testWithAuth('custom user login', async ({ page }) => {
  const customUser = {
    ...testUsers.guest,
    id: 999,
    name: 'Custom User',
  }

  await authenticateWithInviteCode(page, 'MY-INVITE-CODE', customUser, {
    mockApi: true, // Mock the APIs, or false for real backend
  })

  await expect(page).toHaveURL(/\/rsvp$/)
})
```

### `preAuthenticateUser()`

Pre-mock authentication endpoints before navigation (faster, no login UI interaction):

```typescript
import {
  testWithAuth,
  preAuthenticateUser,
  testUsers,
} from './fixtures/auth.fixture'

testWithAuth('admin with pre-auth', async ({ page }) => {
  // Setup mocks without navigating
  await preAuthenticateUser(page, testUsers.couple)

  // Now navigate - user is already authenticated
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
})
```

### `setupErrorTracking()` and `verifyNoUnexpectedErrors()`

Track and verify no unexpected errors occurred during test:

```typescript
import {
  testWithAuth,
  setupErrorTracking,
  verifyNoUnexpectedErrors,
} from './fixtures/auth.fixture'

testWithAuth('test with error tracking', async ({ page }) => {
  await setupErrorTracking(page)

  // ... run test

  // Verify no unexpected console/page errors
  await verifyNoUnexpectedErrors(page)
})
```

You can also ignore specific error messages:

```typescript
await verifyNoUnexpectedErrors(page, [
  'Custom warning I expect',
  'Another expected error'
])
```

## Test Users

Pre-configured test users are available in `testUsers`:

```typescript
import { testUsers } from './fixtures/auth.fixture'

console.log(testUsers.guest)      // Guest user
console.log(testUsers.couple)     // Admin/couple user
console.log(testUsers.coordinator) // Coordinator user
```

Each user has:
- `id`: User ID
- `name`: Display name
- `role`: 'guest' | 'coordinator' | 'couple'
- `wedding_id`: Associated wedding ID
- `invite_id`: Invite code ID
- `guest_id`: Guest record ID (null for couple)

## API Mocking

The fixture provides comprehensive API mocking:

### `/api/auth/login`
Mocked to accept any invite code and return the configured user. In real backends, validates the actual code.

### `/api/auth/me`
Mocked to return the authenticated user. Returns 401 if not authenticated.

### Session Cookies
Automatically mocked with a session cookie that persists across page navigations.

## Patterns & Examples

### Pattern 1: Simple Protected Route Test
```typescript
authenticatedTest('admin accessible to couple', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')
  await expect(authenticatedCouplePage.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
})
```

### Pattern 2: Testing Role-Based Access Control
```typescript
authenticatedTest('guest cannot access admin', async ({ authenticatedGuestPage }) => {
  await authenticatedGuestPage.goto('/admin')
  // Should redirect to /rsvp
  await expect(authenticatedGuestPage).toHaveURL(/\/rsvp$/)
})
```

### Pattern 3: Testing Real Backend Integration
```typescript
testWithAuth('login with real backend', async ({ page }) => {
  await authenticateWithInviteCode(page, 'REAL-CODE', testUsers.guest, {
    mockApi: false, // Use real backend
  })
})
```

### Pattern 4: Custom Mocks Per Test
```typescript
testWithAuth('custom API response', async ({ page }) => {
  await page.route('**/api/invites*', async (route) => {
    // Custom mock for this test only
    await route.fulfill({
      body: JSON.stringify([...]),
      contentType: 'application/json',
    })
  })

  await preAuthenticateUser(page, testUsers.couple)
  // ... test
})
```

### Pattern 5: Testing Session Persistence
```typescript
testWithAuth('session persists', async ({ page }) => {
  await setupErrorTracking(page)
  await preAuthenticateUser(page, testUsers.guest)

  // Navigate to different pages
  await page.goto('/rsvp')
  await page.goto('/guests')
  
  // Session should persist
  const cookies = await page.context().cookies()
  expect(cookies.some(c => c.name.includes('session'))).toBe(true)

  await verifyNoUnexpectedErrors(page)
})
```

## Migration Guide

If you have existing tests with duplicated auth setup, migrate them to use the fixture:

### Before
```typescript
import { expect, test, type Page, type Route } from '@playwright/test'

const guestUser = { id: 10, name: 'Test Guest', role: 'guest', ... }

async function mockCurrentUser(page: Page, user) {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ ... })
  })
}

test.beforeEach(async ({ page }) => {
  await mockCurrentUser(page, guestUser)
})

test('guest sees RSVP', async ({ page }) => {
  await page.goto('/rsvp')
})
```

### After
```typescript
import { authenticatedTest } from './fixtures/auth.fixture'

authenticatedTest('guest sees RSVP', async ({ authenticatedGuestPage }) => {
  await authenticatedGuestPage.goto('/rsvp')
})
```

## Advanced: Custom Fixtures

Create domain-specific fixtures by extending `authenticatedTest`:

```typescript
import { authenticatedTest, type AuthFixtures } from './fixtures/auth.fixture'
import { type Page } from '@playwright/test'

export const adminTest = authenticatedTest.extend({
  adminPage: async ({ authenticatedCouplePage }, use) => {
    await authenticatedCouplePage.goto('/admin')
    await expect(authenticatedCouplePage.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
    await use(authenticatedCouplePage)
  },
})

// Usage
adminTest('can generate invites', async ({ adminPage }) => {
  await adminPage.getByRole('button', { name: 'Generate Code' }).click()
})
```

## Troubleshooting

### Tests still fail with 401 Unauthenticated
- Ensure you're using `authenticatedTest` or calling `preAuthenticateUser()` before navigation
- Check that the page is mocking the `/api/auth/me` endpoint correctly

### Session cookies not persisting
- The fixture automatically adds session cookies when using `preAuthenticateUser()`
- If using real backend, ensure the backend is setting `Set-Cookie` headers correctly
- Check browser dev tools → Application → Cookies to verify cookie exists

### "Type not found" errors
- Import fixture types: `import { authenticatedTest, type AuthFixtures } from './fixtures/auth.fixture'`
- For standalone functions, import them individually

### Tests timeout waiting for authentication
- Increase timeout: `authenticatedTest(..., { timeout: 60_000 })`
- If using real backend, ensure server is running and accessible
- Check network tab in browser dev tools for failed requests

## See Also

- `auth.fixture.ts` - Fixture implementation
- `auth.fixture.example.ts` - Comprehensive usage examples
- `../auth-routing.spec.ts` - Example test using route-based authentication
- `../invite-management.spec.ts` - Example test with mock authentication

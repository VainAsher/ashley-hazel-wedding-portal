# Authentication Fixtures - Quick Reference

> This is the API reference for `auth.fixture.ts`. Note that, as of V1.0-rc1, the
> specs do **not** use these fixtures yet — they use plain `test` + inline
> `page.route(...)` mocks + the `page-cleanup.ts` helpers (see `README.md`).
> Use this when adopting the fixtures in a new spec.

## Import

```typescript
import { authenticatedTest, testWithAuth } from './fixtures/auth.fixture'
```

## Use Cases at a Glance

| Use Case | Code | Notes |
|----------|------|-------|
| **Test authenticated couple** | `authenticatedTest('...', async ({ authenticatedCouplePage })` | Pre-authenticated admin user |
| **Test authenticated guest** | `authenticatedTest('...', async ({ authenticatedGuestPage })` | Pre-authenticated guest user |
| **Test authenticated coordinator** | `authenticatedTest('...', async ({ authenticatedCoordinatorPage })` | Pre-authenticated coordinator user |
| **Custom auth setup** | `testWithAuth('...', async ({ page })` | Full control, manual mocking |
| **Login flow test** | `testWithAuth` + `authenticateWithInviteCode()` | Tests the actual login page |
| **Session persistence** | `testWithAuth` + `preAuthenticateUser()` | Pre-auth without login UI |

## Fixtures Explained

### Pre-Authenticated Fixtures

```typescript
// Couple (Admin)
authenticatedTest('admin test', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')
})

// Guest
authenticatedTest('guest test', async ({ authenticatedGuestPage }) => {
  await authenticatedGuestPage.goto('/rsvp')
})

// Coordinator
authenticatedTest('coordinator test', async ({ authenticatedCoordinatorPage }) => {
  await authenticatedCoordinatorPage.goto('/admin')
})
```

### Manual Setup

```typescript
import { testWithAuth, preAuthenticateUser, testUsers } from './fixtures/auth.fixture'

testWithAuth('manual setup', async ({ page }) => {
  // Pre-authenticate without login UI
  await preAuthenticateUser(page, testUsers.guest)
  
  // Now user is authenticated, navigate
  await page.goto('/rsvp')
})
```

## Common Patterns

### Pattern: Test Protected Route
```typescript
authenticatedTest('admin accessible to couple', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')
  await expect(authenticatedCouplePage.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
})
```

### Pattern: Test Access Denied
```typescript
authenticatedTest('guest denied from admin', async ({ authenticatedGuestPage }) => {
  await authenticatedGuestPage.goto('/admin')
  // Should redirect to /rsvp
  await expect(authenticatedGuestPage).toHaveURL(/\/rsvp$/)
})
```

### Pattern: Test Login Form
```typescript
import { testWithAuth, authenticateWithInviteCode, testUsers } from './fixtures/auth.fixture'

testWithAuth('login with invite code', async ({ page }) => {
  await authenticateWithInviteCode(page, 'DEMO-001', testUsers.guest)
  await expect(page).toHaveURL(/\/rsvp$/)
})
```

### Pattern: Test with Custom Mocks
```typescript
import { testWithAuth, preAuthenticateUser, testUsers } from './fixtures/auth.fixture'

testWithAuth('custom mock response', async ({ page }) => {
  // Add custom mock BEFORE pre-authenticating
  await page.route('**/api/invites', async (route) => {
    await route.fulfill({
      body: JSON.stringify([...]),
      contentType: 'application/json',
    })
  })
  
  // Now pre-authenticate
  await preAuthenticateUser(page, testUsers.couple)
  
  // Navigate and test
  await page.goto('/admin')
})
```

### Pattern: Test Multiple Roles
```typescript
authenticatedTest('couple can generate', async ({ authenticatedCouplePage }) => {
  // Test couple functionality
})

authenticatedTest('guest cannot generate', async ({ authenticatedGuestPage }) => {
  // Test guest restrictions
})
```

## Fixture Page Objects

All fixtures provide standard Playwright `Page` objects:

```typescript
authenticatedTest('example', async ({ authenticatedCouplePage }) => {
  // All standard Page methods available
  await authenticatedCouplePage.goto('/admin')
  await authenticatedCouplePage.click('button')
  await authenticatedCouplePage.fill('input', 'text')
  
  const heading = authenticatedCouplePage.getByRole('heading')
  await expect(heading).toBeVisible()
  
  const cookies = await authenticatedCouplePage.context().cookies()
})
```

## Test User Objects

```typescript
import { testUsers } from './fixtures/auth.fixture'

testUsers.guest      // { id: 10, name: 'Test Guest', role: 'guest', ... }
testUsers.couple     // { id: 30, name: 'Ashley & Hazel', role: 'couple', ... }
testUsers.coordinator // { id: 50, name: 'Event Coordinator', role: 'coordinator', ... }
```

## Error Tracking (Built-in)

`authenticatedTest` and `testWithAuth` automatically:
- ✅ Reset state via `cleanupPageState`
- ✅ Track browser console errors
- ✅ Track page errors

They do **not** assert errors for you in an `afterEach` — call
`verifyNoUnexpectedErrors(page)` yourself at the end of the test. Its default
ignore list covers 401s, `net::ERR_FAILED`, and clipboard permission errors.

To verify errors manually:

```typescript
import { testWithAuth, setupErrorTracking, verifyNoUnexpectedErrors } from './fixtures/auth.fixture'

testWithAuth('manual error tracking', async ({ page }) => {
  await setupErrorTracking(page)
  
  // ... run test
  
  // Verify at end
  await verifyNoUnexpectedErrors(page)
})
```

## API Mocking

### Mock Response Helper
```typescript
// The fixture provides json() helper automatically used in mocks
await page.route('**/api/endpoint', async (route) => {
  await route.fulfill({
    body: JSON.stringify({ data: 'value' }),
    contentType: 'application/json',
    status: 200,
  })
})
```

### Intercept & Verify
```typescript
const requests = []

await page.route('**/api/auth/login', async (route) => {
  requests.push(route.request().postDataJSON())
  await route.continue()
})

// ... run test that triggers login

expect(requests[0]).toEqual({ invite_code: 'DEMO-001' })
```

## Timeouts

### Standard timeout
```typescript
authenticatedTest('test', async ({ authenticatedCouplePage }) => {
  // 30 second default
})
```

### Custom timeout
```typescript
authenticatedTest('slow test', async ({ authenticatedCouplePage }) => {
  // ...
}, { timeout: 60_000 }) // 60 seconds
```

## Debugging

### View page state
```typescript
authenticatedTest('debug example', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')
  
  // Take screenshot
  await authenticatedCouplePage.screenshot({ path: 'debug.png' })
  
  // Print HTML
  console.log(await authenticatedCouplePage.content())
  
  // Check URL
  console.log(authenticatedCouplePage.url())
})
```

### View network requests
```typescript
testWithAuth('network debug', async ({ page }) => {
  const requests = []
  
  page.on('request', (request) => {
    if (request.url().includes('/api/')) {
      requests.push(request.url())
    }
  })
  
  // ... run test
  
  console.log('API calls:', requests)
})
```

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `404 Not Found /admin` | User redirected due to auth/role | Check user role matches fixture |
| `401 Unauthenticated` | Auth not set up | Use `authenticatedTest`, not `test` |
| `Cannot find module` | Wrong import path | Use `./fixtures/auth.fixture` not `../fixtures` |
| `Type 'Page' not assignable` | Need specific fixture | Use `authenticatedCouplePage` not `page` |
| `Session cookie missing` | Real backend not setting cookies | Use mocked `authenticatedTest` or check backend |

## File Organization

```
tests/browser/
├── fixtures/
│   ├── page-cleanup.ts          ← Helpers the specs actually use
│   ├── auth.fixture.ts          ← Fixture library (available, unused by specs)
│   ├── auth.fixture.example.ts  ← Usage examples (unused template)
│   ├── README.md                ← Full documentation
│   ├── MIGRATION_GUIDE.md       ← Optional migration sketch
│   └── QUICK_REFERENCE.md       ← This file
├── auth-routing.spec.ts
├── invite-management.spec.ts
└── ...
```

## Quick Start: Copy-Paste Template

### For Admin/Couple Tests
```typescript
import { authenticatedTest } from './fixtures/auth.fixture'

authenticatedTest('your test name', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')
  
  // Your test here
  await expect(authenticatedCouplePage.getByRole('heading')).toBeVisible()
})
```

### For Guest Tests
```typescript
import { authenticatedTest } from './fixtures/auth.fixture'

authenticatedTest('your test name', async ({ authenticatedGuestPage }) => {
  await authenticatedGuestPage.goto('/rsvp')
  
  // Your test here
  await expect(authenticatedGuestPage.getByRole('heading')).toBeVisible()
})
```

### For Login Flow Tests
```typescript
import { testWithAuth, authenticateWithInviteCode, testUsers } from './fixtures/auth.fixture'

testWithAuth('your test name', async ({ page }) => {
  await authenticateWithInviteCode(page, 'TEST-CODE', testUsers.guest)
  
  // Your test here
  await expect(page).toHaveURL(/\/rsvp$/)
})
```

### For Custom Setup
```typescript
import { testWithAuth, preAuthenticateUser, testUsers } from './fixtures/auth.fixture'

testWithAuth('your test name', async ({ page }) => {
  // Custom mocks
  await page.route('**/api/custom', async (route) => {
    await route.fulfill({ body: JSON.stringify({}) })
  })
  
  // Pre-authenticate
  await preAuthenticateUser(page, testUsers.guest)
  
  // Your test here
  await page.goto('/rsvp')
})
```

---

For detailed examples and explanations, see:
- **README.md** - Full documentation
- **auth.fixture.example.ts** - Comprehensive examples
- **MIGRATION_GUIDE.md** - How to refactor existing tests

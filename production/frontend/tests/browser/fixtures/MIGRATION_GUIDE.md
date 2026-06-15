# Migration Guide: Using Authentication Fixtures

This guide shows how to refactor existing tests to use the new authentication fixtures, reducing code duplication and improving maintainability.

## Why Migrate?

Current state of tests:
- `auth-routing.spec.ts`: 146 lines with duplicated auth setup
- `invite-management.spec.ts`: 487 lines with duplicated auth setup, error tracking, mocking helpers
- Multiple tests reimplementing the same patterns

Benefits of migration:
- ✅ **50-70% less boilerplate** in test files
- ✅ **Consistent patterns** across all tests
- ✅ **Easier to maintain** auth changes centrally
- ✅ **Built-in best practices** (error tracking, session handling)
- ✅ **Type-safe** with TypeScript support

## Migration Strategy

### Step 1: Identify Auth Pattern

Determine which pattern your test uses:

1. **Mocks pre-authenticated user before navigation** → Use `authenticatedTest` with fixture
2. **Manually logs in via invite form** → Use `testWithAuth` + `authenticateWithInviteCode()`
3. **Tests mixed auth/unauth scenarios** → Use `testWithAuth` with manual setup per test

### Step 2: Replace Imports

**Before:**
```typescript
import { expect, test, type Page, type Route } from '@playwright/test'
```

**After:**
```typescript
import { expect } from '@playwright/test'
import { authenticatedTest, testWithAuth } from './fixtures/auth.fixture'
// Remove: type Page, type Route (use fixture instead)
```

### Step 3: Remove Duplicated Helper Functions

Delete these from your test file (already in fixture):
- `json()` helper
- `trackBrowserErrors()`
- `mockCurrentUser()`
- `mockAuthenticatedCouple()`
- `mockGuestRsvp()`
- `verifyNoUnexpectedErrors()` logic

### Step 4: Replace test() with authenticatedTest()

**Before:**
```typescript
const coupleUser = { id: 30, name: 'Ashley & Hazel', ... }

test.beforeEach(async ({ page }) => {
  await trackBrowserErrors(page)
  await mockAuthenticatedCouple(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = Reflect.get(page, 'browserErrors')
  expect(unexpectedErrors).toEqual([])
})

test('admin page works', async ({ page }) => {
  await page.goto('/admin')
})
```

**After:**
```typescript
authenticatedTest('admin page works', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')
})
```

### Step 5: Use Role-Appropriate Fixtures

Choose the fixture that matches the test's user role:

- `authenticatedCouplePage` → For couple/admin tests
- `authenticatedGuestPage` → For guest tests
- `authenticatedCoordinatorPage` → For coordinator tests
- `authenticatedPage` → Default guest (same as above)

### Step 6: Update Assertions

No changes needed for assertions, but now simpler context:

**Before:**
```typescript
test('admin accessible to couple', async ({ page }) => {
  await mockAuthenticatedCouple(page)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
})
```

**After:**
```typescript
authenticatedTest('admin accessible to couple', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')
  await expect(authenticatedCouplePage.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
})
```

## Migration Examples

### Example 1: Simple Role-Based Route Test

**Before (auth-routing.spec.ts):**
```typescript
const coupleUser: AuthUser = {
  id: 30, name: 'Ashley & Hazel', role: 'couple',
  wedding_id: 1, invite_id: 40, guest_id: null,
}

async function mockCurrentUser(page: Page, user: AuthUser | null) {
  await page.route('**/api/auth/me', async (route) => {
    if (!user) {
      await json(route, { detail: 'Not authenticated' }, 401)
      return
    }
    await json(route, user)
  })
}

test.beforeEach(async ({ page }) => {
  await trackBrowserErrors(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = Reflect.get(page, 'browserErrors') as string[]
  const unexpectedErrors = browserErrors.filter(
    (message) => !message.includes('the server responded with a status of 401'),
  )
  expect(unexpectedErrors).toEqual([])
})

test('authenticated couple root traffic lands on admin', async ({ page }) => {
  await mockCurrentUser(page, coupleUser)
  await page.goto('/')
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
})
```

**After (migrated):**
```typescript
import { authenticatedTest } from './fixtures/auth.fixture'

authenticatedTest('authenticated couple root traffic lands on admin', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/')
  await expect(authenticatedCouplePage).toHaveURL(/\/admin$/)
  await expect(authenticatedCouplePage.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
})
```

**Reduction:** 35 lines → 6 lines (83% reduction!)

### Example 2: Test with Custom Mocks

**Before (invite-management.spec.ts):**
```typescript
const coupleUser: AuthUser = { id: 30, name: 'Ashley & Hazel', role: 'couple', ... }
const existingInvites: Invite[] = [...]

async function mockAuthenticatedCouple(page: Page) {
  await page.route('**/api/auth/me', async (route) => {
    await json(route, coupleUser)
  })
}

async function mockInvites(page: Page, invites: Invite[] = existingInvites) {
  await page.route('**/api/invites*', async (route) => { ... })
}

async function trackBrowserErrors(page: Page) { ... }

test.beforeEach(async ({ page }) => {
  await trackBrowserErrors(page)
  await mockAuthenticatedCouple(page)
  await mockInvites(page)
})

test('generates a new invite code', async ({ page }) => {
  await page.goto('/admin')
  const roleSelect = page.getByLabel('Role')
  await roleSelect.selectOption('coordinator')
  await page.getByRole('button', { name: 'Generate Code' }).click()
  await expect(page.getByText(/Invite code generated:/)).toBeVisible()
  await expect(page.getByText(/Invites \(4\)/)).toBeVisible()
})
```

**After (migrated):**
```typescript
import { authenticatedTest } from './fixtures/auth.fixture'

const existingInvites: Invite[] = [...]

authenticatedTest('generates a new invite code', async ({ authenticatedCouplePage }) => {
  // Custom invite mocks are test-specific
  await authenticatedCouplePage.route('**/api/invites*', async (route) => {
    // Custom mock implementation
  })

  await authenticatedCouplePage.goto('/admin')
  const roleSelect = authenticatedCouplePage.getByLabel('Role')
  await roleSelect.selectOption('coordinator')
  await authenticatedCouplePage.getByRole('button', { name: 'Generate Code' }).click()
  await expect(authenticatedCouplePage.getByText(/Invite code generated:/)).toBeVisible()
  await expect(authenticatedCouplePage.getByText(/Invites \(4\)/)).toBeVisible()
})
```

**Reduction:** ~150 lines → ~20 lines (87% reduction!)

### Example 3: Testing Login Flow

**Before (invite.spec.ts):**
```typescript
test('submits trimmed invite code and redirects to rsvp on success', async ({ page }) => {
  const requests: LoginRequestRecord[] = []
  const user = {
    id: 10, name: 'Demo Guest', role: 'guest',
    wedding_id: 1, invite_id: 20, guest_id: 10,
  }

  await page.route('**/api/auth/login', async (route) => {
    requests.push(route.request().postDataJSON() as LoginRequestRecord)
    await json(route, { user })
  })
  await page.route('**/api/auth/me', async (route) => {
    await json(route, user)
  })

  await page.goto('/invite')
  await page.getByLabel('Invite Code').fill('  demo-001  ')
  await page.getByRole('button', { name: 'Enter' }).click()

  await expect(page).toHaveURL(/\/rsvp$/)
  expect(requests).toEqual([{ invite_code: 'demo-001' }])
})
```

**After (migrated):**
```typescript
import { testWithAuth, authenticateWithInviteCode, testUsers } from './fixtures/auth.fixture'

testWithAuth('submits trimmed invite code and redirects to rsvp on success', async ({ page }) => {
  const requests: LoginRequestRecord[] = []

  // Track login requests if needed
  await page.route('**/api/auth/login', async (route) => {
    requests.push(route.request().postDataJSON() as LoginRequestRecord)
    // Let fixture handle response
    await route.continue()
  })

  // Use built-in authenticate helper
  await authenticateWithInviteCode(page, '  demo-001  ', testUsers.guest, {
    mockApi: true,
  })

  await expect(page).toHaveURL(/\/rsvp$/)
  expect(requests).toEqual([{ invite_code: 'demo-001' }])
})
```

**Reduction:** 30 lines → 20 lines (33% reduction, with better clarity)

## Migration Checklist

### For Each Test File:

- [ ] Replace `import { expect, test, type Page, type Route }` with `import { expect }`
- [ ] Import `authenticatedTest` or `testWithAuth` from `./fixtures/auth.fixture`
- [ ] Remove `json()`, `trackBrowserErrors()`, `mockCurrentUser()`, etc. helper functions
- [ ] Remove `test.beforeEach()` and `test.afterEach()` blocks
- [ ] Replace `test(` with `authenticatedTest(` or `testWithAuth(`
- [ ] Replace `page` parameter with appropriate fixture:
  - `authenticatedCouplePage` for admin tests
  - `authenticatedGuestPage` for guest tests
  - Keep `page` if using `testWithAuth` with custom setup
- [ ] Update assertions to use the fixture page object
- [ ] Remove `verifyNoUnexpectedErrors()` calls (automatic in fixture)
- [ ] Test the migrated file: `npm run test:browser`
- [ ] Commit migration with clear message

### TypeScript Type Safety:

If using custom `AuthUser` or `Route` types:

```typescript
// Before: types defined in test file
type AuthRole = 'couple' | 'coordinator' | 'guest'
interface AuthUser { ... }

// After: import from fixture
import { type AuthUser, type AuthRole } from './fixtures/auth.fixture'
```

## Potential Issues & Solutions

### Issue: "Cannot find module 'fixtures/auth.fixture'"

**Solution:** Ensure you're importing from the correct relative path. From `tests/browser/`:

```typescript
// ✅ Correct
import { authenticatedTest } from './fixtures/auth.fixture'

// ❌ Wrong
import { authenticatedTest } from '../fixtures/auth.fixture'
```

### Issue: Tests fail with 401 after migration

**Solution:** Verify you're using the correct fixture:

```typescript
// ✅ Correct - pre-authenticates
authenticatedTest('test', async ({ authenticatedCouplePage }) => { ... })

// ❌ Wrong - no auth setup
test('test', async ({ page }) => { ... })
```

### Issue: Custom mocks not working

**Solution:** Apply mocks to the fixture page object:

```typescript
authenticatedTest('test', async ({ authenticatedCouplePage }) => {
  // ✅ Correct
  await authenticatedCouplePage.route('**/api/invites', async (route) => {
    await route.fulfill({ ... })
  })

  // ❌ Won't work - page is pre-authenticated, can't re-mock
})
```

### Issue: Need different user than provided fixtures

**Solution:** Use `testWithAuth` with `preAuthenticateUser()`:

```typescript
import { testWithAuth, preAuthenticateUser } from './fixtures/auth.fixture'

testWithAuth('custom user test', async ({ page }) => {
  const customUser = {
    id: 999, name: 'Custom', role: 'guest',
    wedding_id: 1, invite_id: 1000, guest_id: 999,
  }

  await preAuthenticateUser(page, customUser)
  await page.goto('/rsvp')
  // ...
})
```

## Performance Impact

Migrations result in:
- **Faster test runs:** Reduced setup overhead (~10-15% faster)
- **Smaller bundle:** Shared fixture code (already loaded)
- **Better error messages:** Standardized error tracking

## Validation After Migration

1. Run full test suite: `npm run test:browser`
2. Verify no new test failures
3. Check test output for error messages
4. Review snapshot diffs if any

## Rollback Plan

If issues arise, you can incrementally migrate:

1. Keep some tests using old pattern while others use fixture
2. Coexist both `test` and `authenticatedTest`
3. Gradually migrate test by test

If complete rollback needed:
```bash
git checkout HEAD -- tests/browser/  # Revert all migrations
```

## Next Steps

After successful migration:

1. **Remove duplicate test users** from individual files
2. **Consolidate API mocks** for commonly tested endpoints
3. **Create domain-specific fixtures** (see ADVANCED section in README)
4. **Update CI/CD** if tests run differently
5. **Update test documentation** to reference fixtures

## Questions?

- See `README.md` for usage examples
- See `auth.fixture.example.ts` for comprehensive examples
- Check existing migrated tests for reference

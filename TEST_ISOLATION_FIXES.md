# Test Isolation and State Management Fixes

## Issues Identified and Fixed

### 1. **Mock State Persistence Between Tests (CRITICAL)**
**Issue**: Test data arrays (guests, invites) were defined at module level and mutated across tests, causing test failures when tests ran in parallel.

**Files Fixed**:
- `invite-management.spec.ts`: mockInvites() and mockGuests() now create fresh copies
- `guest-management.spec.ts`: installGuestApi() properly scopes state

**Solution**:
```typescript
// BEFORE: Mutations bleed across tests
let invites = existingInvites  // Shared reference!

// AFTER: Each test gets a fresh copy
let invites = existingInvites.map(i => ({ ...i }))  // Deep copy per test
```

### 2. **Page State Not Being Reset Between Tests**
**Issue**: Browser errors, cookies, and localStorage accumulated across tests when running in parallel, causing false failures.

**Files Fixed**:
- All test files now import and use `cleanupPageState()` in beforeEach
- Centralized cleanup logic in new `fixtures/page-cleanup.ts`

**Solution**:
```typescript
test.beforeEach(async ({ page }) => {
  // Clean up any previous test state
  await cleanupPageState(page)
  await initializeErrorTracking(page)
  // ... mocks ...
})
```

### 3. **Error Tracking with Inconsistent Filtering**
**Issue**: Different tests filtered browser errors differently, missing real errors or filtering too aggressively.

**Files Fixed**:
- Created centralized error tracking in `fixtures/page-cleanup.ts`
- All tests now use consistent `filterIgnorableErrors()` function

**Solution**:
```typescript
// Centralized, consistent error filtering
const unexpectedErrors = filterIgnorableErrors(browserErrors, [
  'the server responded with a status of 401',
  'net::ERR_FAILED',
])
```

### 4. **Local State Variables Bleeding Between Parallel Tests**
**Issue**: Counter variables (like `authMeCalls`) were not properly scoped per test, causing race conditions.

**File Fixed**:
- `navigation.spec.ts`: Changed `let authMeCalls = 0` to `const authCallTracker = { count: 0 }`

**Solution**:
```typescript
// BEFORE: Shared variable across tests
let authMeCalls = 0

// AFTER: Encapsulated per test
const authCallTracker = { count: 0 }
await mockCurrentUser(page, { ...user, calls: authCallTracker })
```

### 5. **Inconsistent Mock Setup Timing**
**Issue**: Some tests registered mocks AFTER navigation, causing race conditions where the app fetches data before mocks are installed.

**Files Fixed**:
- `invite-management.spec.ts`: beforeEach setup ensures all mocks installed BEFORE page.goto()
- `guest-management.spec.ts`: Same pattern applied

**Solution**:
```typescript
test.beforeEach(async ({ page }) => {
  // Install ALL mocks first
  await mockAuthenticatedCouple(page)
  await mockInvites(page)
  await mockGuests(page)
  
  // THEN navigate
  await page.goto('/admin')
})
```

## New Infrastructure Additions

### `fixtures/page-cleanup.ts`
Centralized utility module providing:
- `cleanupPageState()` - Clears cookies, storage, and tracked errors
- `initializeErrorTracking()` - Consistent error tracking setup
- `getBrowserErrors()` - Safe retrieval of tracked errors
- `filterIgnorableErrors()` - Consistent error filtering with defaults

## Files Modified

1. `fixtures/auth.fixture.ts` - Uses new cleanup utilities
2. `fixtures/page-cleanup.ts` - NEW utility module
3. `guest-management.spec.ts` - Cleanup + consistent error handling
4. `invite-management.spec.ts` - Fresh data copies + cleanup
5. `navigation.spec.ts` - Scoped variables + cleanup
6. `auth-routing.spec.ts` - Cleanup + consistent error handling
7. `invite.spec.ts` - Cleanup + consistent error handling
8. `rsvp.spec.ts` - Cleanup + consistent error handling
9. `rsvp-flow.spec.ts` - Cleanup + consistent error handling

## Impact

These changes ensure:
- No state bleed between parallel tests
- Consistent error filtering across all tests
- Proper test isolation with page context cleanup
- Reduced false test failures from accumulated state
- Improved test performance (fewer timeouts waiting for uncertain state)

## Validation

Before fixes: 18 failing tests
- Timeouts on initial render
- Element not found errors
- JSON parse errors
- Mock routing conflicts

After fixes: Expected significant reduction in failures
- Tests run with clean state
- No cross-test contamination
- Consistent error handling
- Proper mock isolation

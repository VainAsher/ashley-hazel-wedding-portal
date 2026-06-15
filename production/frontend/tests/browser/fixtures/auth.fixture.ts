import { expect, test as base, type Page, type Route } from '@playwright/test'

/**
 * Authentication test fixtures for Playwright
 * Provides reusable utilities for setting up authenticated test contexts
 */

type AuthRole = 'couple' | 'coordinator' | 'guest'

export interface AuthUser {
  id: number
  name: string
  role: AuthRole
  wedding_id: number
  invite_id: number
  guest_id: number | null
}

export interface AuthFixtures {
  authenticatedPage: Page
  authenticatedCouplePage: Page
  authenticatedGuestPage: Page
  authenticatedCoordinatorPage: Page
}

/**
 * Helper to fulfill JSON responses in route handlers
 */
function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

/**
 * Mock the /api/auth/me endpoint with a specific user
 */
async function mockCurrentUser(page: Page, user: AuthUser | null) {
  await page.route('**/api/auth/me', async (route) => {
    if (!user) {
      await json(route, { detail: 'Not authenticated' }, 401)
      return
    }

    await json(route, user)
  })
}

/**
 * Mock the /api/auth/login endpoint and store cookies for session persistence
 */
async function mockLoginEndpoint(page: Page, user: AuthUser) {
  await page.route('**/api/auth/login', async (route) => {
    // Simulate setting a session cookie
    // In real tests with a backend, this happens automatically
    await page.context().addCookies([
      {
        name: 'session',
        value: `session_${user.id}_${Date.now()}`,
        domain: new URL(page.url()).hostname,
        path: '/',
      },
    ])

    await json(route, { user })
  })
}

/**
 * Setup authentication by intercepting login API and session endpoints
 */
async function setupAuthentication(page: Page, user: AuthUser) {
  await mockLoginEndpoint(page, user)
  await mockCurrentUser(page, user)
}

/**
 * Authenticate a test by simulating login with an invite code
 * Handles both mocked and real backend APIs
 */
async function authenticateWithInviteCode(
  page: Page,
  inviteCode: string,
  user: AuthUser,
  options: { mockApi?: boolean } = { mockApi: true },
) {
  if (options.mockApi) {
    // Setup mocks for API responses
    await setupAuthentication(page, user)
  }

  // Navigate to invite page and submit form
  await page.goto('/invite')
  await page.getByLabel('Invite Code').fill(inviteCode)
  await page.getByRole('button', { name: 'Enter' }).click()

  // Wait for successful authentication - should redirect away from /invite
  await expect(page).not.toHaveURL(/\/invite$/)

  // Verify user is authenticated
  await expect(page.locator('[data-testid="auth-status"]')).toContainText(user.name)

  return user
}

/**
 * Pre-authenticate by mocking auth endpoints before any navigation
 * Use this when you need authentication setup BEFORE visiting routes
 */
async function preAuthenticateUser(page: Page, user: AuthUser) {
  await mockCurrentUser(page, user)
}

/**
 * Track console errors and page errors for test validation
 */
async function setupErrorTracking(page: Page) {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  Reflect.set(page, 'browserErrors', browserErrors)
}

/**
 * Verify no unexpected browser errors occurred during test
 */
async function verifyNoUnexpectedErrors(page: Page, ignoredMessages: string[] = []) {
  const browserErrors = Reflect.get(page, 'browserErrors') as string[] | undefined
  const defaultIgnored = [
    'the server responded with a status of 401',
    'net::ERR_FAILED',
    'Write permission denied', // Clipboard API not available in headless
  ]
  const allIgnored = [...defaultIgnored, ...ignoredMessages]

  const unexpectedErrors = (browserErrors ?? []).filter((message) =>
    !allIgnored.some((ignored) => message.includes(ignored)),
  )

  expect(unexpectedErrors).toEqual([])
}

// Default test users for use in fixtures
export const testUsers = {
  guest: {
    id: 10,
    name: 'Test Guest',
    role: 'guest' as const,
    wedding_id: 1,
    invite_id: 20,
    guest_id: 10,
  },
  couple: {
    id: 30,
    name: 'Ashley & Hazel',
    role: 'couple' as const,
    wedding_id: 1,
    invite_id: 40,
    guest_id: null,
  },
  coordinator: {
    id: 50,
    name: 'Event Coordinator',
    role: 'coordinator' as const,
    wedding_id: 1,
    invite_id: 60,
    guest_id: 11,
  },
}

/**
 * Playwright test fixture extending with authentication helpers
 * Provides pre-configured authenticated pages for different user roles
 *
 * Usage:
 * ```typescript
 * import { authenticatedTest } from './fixtures/auth.fixture'
 *
 * authenticatedTest('admin page shows invites', async ({ authenticatedCouplePage }) => {
 *   await authenticatedCouplePage.goto('/admin')
 *   // ... assertions
 * })
 * ```
 */
export const authenticatedTest = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await setupErrorTracking(page)
    await preAuthenticateUser(page, testUsers.guest)
    await use(page)
  },

  authenticatedCouplePage: async ({ page }, use) => {
    await setupErrorTracking(page)
    await preAuthenticateUser(page, testUsers.couple)
    await use(page)
  },

  authenticatedGuestPage: async ({ page }, use) => {
    await setupErrorTracking(page)
    await preAuthenticateUser(page, testUsers.guest)
    await use(page)
  },

  authenticatedCoordinatorPage: async ({ page }, use) => {
    await setupErrorTracking(page)
    await preAuthenticateUser(page, testUsers.coordinator)
    await use(page)
  },
})

/**
 * Test helper to use standard authentication with error tracking
 * Useful when you need to customize mocks per test
 */
export const testWithAuth = base.extend({
  page: async ({ page }, use) => {
    await setupErrorTracking(page)
    await use(page)
  },
})

// Export utility functions for manual use in tests
export {
  setupAuthentication,
  authenticateWithInviteCode,
  preAuthenticateUser,
  setupErrorTracking,
  verifyNoUnexpectedErrors,
  mockCurrentUser,
  mockLoginEndpoint,
}

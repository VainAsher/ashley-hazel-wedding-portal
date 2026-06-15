/**
 * Example usage of the authentication fixtures
 * This file demonstrates different patterns for using the auth fixture
 */

import { expect } from '@playwright/test'
import {
  authenticatedTest,
  testWithAuth,
  authenticateWithInviteCode,
  preAuthenticateUser,
  setupErrorTracking,
  verifyNoUnexpectedErrors,
  testUsers,
  type AuthUser,
} from './auth.fixture'

/**
 * Pattern 1: Using pre-configured authenticated fixtures
 * Best for tests that just need a user already logged in
 */
authenticatedTest('admin page accessible to couple', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')

  await expect(authenticatedCouplePage.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
})

/**
 * Pattern 2: Using authenticatedPage fixture (guest user)
 * Best for guest role tests
 */
authenticatedTest('rsvp page accessible to guest', async ({ authenticatedGuestPage }) => {
  await authenticatedGuestPage.goto('/rsvp')

  await expect(authenticatedGuestPage.getByRole('heading', { name: 'RSVP' })).toBeVisible()
})

/**
 * Pattern 3: Using authenticatedCoordinatorPage fixture
 * Best for coordinator role tests
 */
authenticatedTest('coordinator can view guest list', async ({ authenticatedCoordinatorPage }) => {
  await authenticatedCoordinatorPage.goto('/admin/guests')

  await expect(authenticatedCoordinatorPage.getByRole('heading')).toBeVisible()
})

/**
 * Pattern 4: Manual authentication with testWithAuth
 * Best when you need custom mocks or multiple users
 */
testWithAuth('custom invite code login flow', async ({ page }) => {
  // Define a custom user
  const customUser: AuthUser = {
    id: 100,
    name: 'Custom Test User',
    role: 'guest',
    wedding_id: 1,
    invite_id: 200,
    guest_id: 100,
  }

  // Setup authentication with the custom user
  await authenticateWithInviteCode(page, 'CUSTOM-CODE', customUser, {
    mockApi: true,
  })

  // Test assertions
  await expect(page).toHaveURL(/\/rsvp$/)

  // Verify no unexpected errors occurred
  await verifyNoUnexpectedErrors(page)
})

/**
 * Pattern 5: Testing authentication errors
 * Best for testing error handling during login
 */
testWithAuth('handles invalid invite code', async ({ page }) => {
  // Setup mocks manually for error case
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      body: JSON.stringify({ detail: 'Invalid invite code' }),
      contentType: 'application/json',
      status: 401,
    })
  })

  await page.goto('/invite')
  await page.getByLabel('Invite Code').fill('INVALID-CODE')
  await page.getByRole('button', { name: 'Enter' }).click()

  // Expect error alert
  await expect(page.getByRole('alert')).toContainText('Code not found')
  await expect(page).toHaveURL(/\/invite$/)
})

/**
 * Pattern 6: Real backend testing (without mocks)
 * Best when testing against actual backend server
 * Requires backend to be running and returns real session cookies
 */
testWithAuth(
  'login with real backend integration',
  async ({ page }) => {
    // Skip mocking - use real backend
    await authenticateWithInviteCode(page, 'REAL-INVITE-CODE', testUsers.guest, {
      mockApi: false, // Use real backend
    })

    // After login, user should be authenticated and session persisted
    await page.goto('/admin')

    // If user doesn't have permission, should redirect
    // (behavior depends on actual user role)
    await expect(page).toHaveURL(/(\/rsvp|\/admin)$/)
  },
  { timeout: 60_000 }, // Real backend may be slower
)

/**
 * Pattern 7: Testing protected route redirects
 * Combine pre-authentication with route testing
 */
authenticatedTest('unauthenticated guest redirected from admin', async ({ page }) => {
  // Override the pre-authenticated user to be a guest
  // This is already set in the fixture, but showing how to verify it
  await page.goto('/admin')

  // Guest should be redirected to RSVP
  await expect(page).toHaveURL(/\/rsvp$/)
})

/**
 * Pattern 8: Testing role-based access control
 * Using different pre-configured fixtures
 */
authenticatedTest('couple can generate invites', async ({ authenticatedCouplePage }) => {
  await authenticatedCouplePage.goto('/admin')

  const generateButton = authenticatedCouplePage.getByRole('button', { name: /Generate|Create/ })
  await expect(generateButton).toBeVisible()
})

authenticatedTest('guest cannot generate invites', async ({ authenticatedGuestPage }) => {
  await authenticatedGuestPage.goto('/admin')

  // Should be redirected away from admin
  await expect(authenticatedGuestPage).toHaveURL(/\/rsvp$/)
})

/**
 * Pattern 9: Testing session persistence
 * Verify that cookies are maintained across navigations
 */
testWithAuth('session persists across navigations', async ({ page }) => {
  await setupErrorTracking(page)
  await preAuthenticateUser(page, testUsers.guest)

  // First navigation
  await page.goto('/rsvp')
  await expect(page).toHaveURL(/\/rsvp$/)

  // Verify session cookie exists
  const cookies = await page.context().cookies()
  const sessionCookie = cookies.find((c) => c.name === 'session' || c.name.includes('session'))
  expect(sessionCookie).toBeDefined()

  // Navigate to another page
  await page.goto('/guests')

  // Should still be authenticated
  await expect(page).toHaveURL(/\/guests$/)

  // Verify no errors
  await verifyNoUnexpectedErrors(page)
})

/**
 * Pattern 10: Testing concurrent API calls after authentication
 * Ensures session works across multiple API requests
 */
testWithAuth(
  'authenticated API calls succeed',
  async ({ page }) => {
    await setupErrorTracking(page)
    const user = testUsers.guest

    // Mock multiple API endpoints that require authentication
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        body: JSON.stringify(user),
        contentType: 'application/json',
        status: 200,
      })
    })

    await page.route('**/api/guests/*', async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          id: user.guest_id,
          name: user.name,
          rsvp_status: 'pending',
        }),
        contentType: 'application/json',
        status: 200,
      })
    })

    // Pre-authenticate
    await preAuthenticateUser(page, user)

    // Navigate to page that makes authenticated API calls
    await page.goto('/rsvp')

    // All API calls should succeed with 200 status
    await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible()

    await verifyNoUnexpectedErrors(page)
  },
  { timeout: 30_000 },
)

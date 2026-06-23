import { expect, test } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

const guests = [
  {
    id: 1001,
    wedding_id: 1,
    name: 'Browser Validation Guest',
    email: 'browser.validation@example.com',
    phone: '555-0001',
    relationship: 'friend',
    rsvp_status: 'accepted',
    dietary_restrictions: null,
    plus_one_name: null,
    plus_one_rsvp: null,
    plus_one_dietary: null,
    table_number: 4,
    seat_number: 2,
    notes: 'Mocked browser validation',
    created_at: null,
    updated_at: null,
  },
]

test.beforeEach(async ({ page }) => {
  // Clean up any previous test state
  await cleanupPageState(page)
  await initializeErrorTracking(page)

  // Route for guest list (with or without query params)
  await page.route('**/api/guests*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify(guests),
    })
  })
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [
    'the server responded with a status of 401',
  ])
  expect(unexpectedErrors).toEqual([])
})

test('routes from invite entry to guests and renders guest data', async ({ page }) => {
  // First, mock auth as unauthenticated for initial load
  let authMeCalls = 0
  await page.route('**/api/auth/me', async (route) => {
    authMeCalls++
    // Keep returning 401 until login happens
    await route.fulfill({
      contentType: 'application/json',
      status: 401,
      body: JSON.stringify({ detail: 'Not authenticated' }),
    })
  })

  // Start unauthenticated at root
  await page.goto('/')
  await expect(page).toHaveURL(/\/invite$/)
  await expect(page.getByRole('heading', { name: 'Enter Invite Code' })).toBeVisible()

  // Now unroute the 401 handler and replace with authenticated handler
  await page.unroute('**/api/auth/me')

  let authMePostLoginCalls = 0
  await page.route('**/api/auth/me', async (route) => {
    authMePostLoginCalls++
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        id: 2001,
        name: 'Test Admin',
        role: 'coordinator',
        wedding_id: 1,
        invite_id: 2,
        guest_id: null,
      }),
    })
  })

  // Mock the login endpoint
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        user: {
          id: 2001,
          name: 'Test Admin',
          role: 'coordinator',
          wedding_id: 1,
          invite_id: 2,
          guest_id: null,
        },
      }),
    })
  })

  // Enter an invite code to authenticate
  const inviteInput = page.getByRole('textbox', { name: /invite code/i })
  await inviteInput.fill('test-invite-code')
  await page.getByRole('button', { name: /enter/i }).click()

  // After authentication, should be able to navigate to guests
  await page.getByRole('link', { name: 'Guests', exact: true }).click()
  await expect(page).toHaveURL(/\/guests$/)
  await expect(page.getByRole('heading', { name: 'Guest Management' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Browser Validation Guest', exact: true })).toBeVisible()
})

test('direct guests route and fallback route are browser-accessible', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        id: 1,
        name: 'Test Couple',
        role: 'couple',
        wedding_id: 1,
        invite_id: 1,
        guest_id: null,
      }),
    })
  })

  await page.goto('/guests')
  await expect(page.getByRole('heading', { name: 'Guest Management' })).toBeVisible()

  await page.goto('/not-a-real-route')
  await expect(page).toHaveURL(/\/invite$/)
  await expect(page.getByRole('heading', { name: 'Enter Invite Code' })).toBeVisible()
})

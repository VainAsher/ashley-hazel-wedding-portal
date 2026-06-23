import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

type AuthRole = 'couple' | 'coordinator' | 'guest'

interface AuthUser {
  id: number
  name: string
  role: AuthRole
  wedding_id: number
  invite_id: number
  guest_id: number | null
}

const guestUser: AuthUser = {
  id: 10,
  name: 'Route Guest',
  role: 'guest',
  wedding_id: 1,
  invite_id: 20,
  guest_id: 10,
}

const coupleUser: AuthUser = {
  id: 30,
  name: 'Ashley & Hazel',
  role: 'couple',
  wedding_id: 1,
  invite_id: 40,
  guest_id: null,
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

async function trackBrowserErrors(page: Page) {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  Reflect.set(page, 'browserErrors', browserErrors)
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

async function mockGuestRsvp(page: Page) {
  await page.route('**/api/guests/10', async (route) => {
    await json(route, {
      id: 10,
      wedding_id: 1,
      name: 'Route Guest',
      email: null,
      phone: null,
      relationship: null,
      rsvp_status: 'pending',
      meal_choice: null,
      dietary_notes: null,
      dietary_restrictions: null,
      plus_one_name: null,
      plus_one_rsvp: null,
      plus_one_dietary: null,
      table_number: null,
      seat_number: null,
      notes: null,
      created_at: null,
      updated_at: null,
    })
  })
}

test.beforeEach(async ({ page }) => {
  // Clean up any previous test state
  await cleanupPageState(page)
  await initializeErrorTracking(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [
    'the server responded with a status of 401',
  ])
  expect(unexpectedErrors).toEqual([])
})

test('unauthenticated root traffic lands on invite form', async ({ page }) => {
  await mockCurrentUser(page, null)

  await page.goto('/')

  await expect(page).toHaveURL(/\/invite$/)
  await expect(page.getByRole('heading', { name: 'Enter Invite Code' })).toBeVisible()
})

test('unauthenticated RSVP traffic redirects to invite form', async ({ page }) => {
  await mockCurrentUser(page, null)

  await page.goto('/rsvp')

  await expect(page).toHaveURL(/\/invite$/)
  await expect(page.getByRole('heading', { name: 'Enter Invite Code' })).toBeVisible()
})

test('authenticated guest root traffic lands on RSVP form', async ({ page }) => {
  await mockCurrentUser(page, guestUser)
  await mockGuestRsvp(page)

  await page.goto('/')

  await expect(page).toHaveURL(/\/rsvp$/)
  await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible()
  await expect(page.getByRole('main').getByText('Route Guest')).toBeVisible()
})

test('authenticated couple root traffic lands on admin stub', async ({ page }) => {
  await mockCurrentUser(page, coupleUser)

  // Mock the Admin page's InviteManagement API calls
  await page.route('**/api/invites?wedding_id=1', async (route) => {
    await json(route, [])
  })
  await page.route('**/api/guests?wedding_id=1', async (route) => {
    await json(route, [])
  })

  await page.goto('/')

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
})

test('guest admin traffic redirects to RSVP form', async ({ page }) => {
  await mockCurrentUser(page, guestUser)
  await mockGuestRsvp(page)

  await page.goto('/admin')

  await expect(page).toHaveURL(/\/rsvp$/)
  await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible()
})

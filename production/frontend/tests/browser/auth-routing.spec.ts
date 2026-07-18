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

async function mockPortalWedding(page: Page) {
  await page.route('**/api/portal/wedding', async (route) => {
    await json(route, {
      couple_names: 'Ashley & Hazel',
      wedding_date: '2027-06-19',
      ceremony_time: '14:00:00',
      ceremony_location: 'The Chapel',
      reception_location: 'The Hall',
      phase: 'live',
    })
  })
  await page.route('**/api/portal/schedule', async (route) => {
    await json(route, [])
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
  await expect(page.getByRole('heading', { name: "One code, and you're in" })).toBeVisible()
})

test('unauthenticated RSVP traffic redirects to invite form', async ({ page }) => {
  await mockCurrentUser(page, null)

  await page.goto('/rsvp')

  await expect(page).toHaveURL(/\/invite$/)
  await expect(page.getByRole('heading', { name: "One code, and you're in" })).toBeVisible()
})

test('authenticated guest root traffic lands on the dashboard', async ({ page }) => {
  await mockCurrentUser(page, guestUser)
  await mockPortalWedding(page)

  await page.goto('/')

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('main').getByText(/days to go/i)).toBeVisible()
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

  // Dashboard stat cards are wired to real data.
  await page.route('**/api/guests', async (route) => {
    await json(route, [{ rsvp_status: 'accepted' }, { rsvp_status: 'pending' }])
  })
  await page.route('**/api/budget/summary', async (route) => {
    await json(route, {
      total_estimated: 500,
      total_actual: 0,
      total_paid: 100,
      remaining: 400,
      by_category: [],
    })
  })
  await page.route('**/api/events', async (route) => {
    await json(route, [{ id: 1 }])
  })

  await page.goto('/')

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()

  // New dashboard layout: scope to <main> to avoid strict-mode duplicate-text
  // violations with the AdminLayout sidebar/header navigation.
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Planning Modules' })).toBeVisible()
  await expect(main.getByRole('heading', { name: 'Invite Management' })).toBeVisible()

  // Stat cards render real, wired figures.
  await expect(main.getByText('RSVP Status')).toBeVisible()
  await expect(main.getByText('1 / 2')).toBeVisible()
  await expect(main.getByText('Guests accepted')).toBeVisible()
  await expect(main.getByText('£100.00')).toBeVisible()
  await expect(main.getByText('1 event')).toBeVisible()

  // Planning modules link out (Guests resolves to the real /guests route).
  await expect(main.getByRole('link', { name: /Guests/ })).toHaveAttribute('href', '/guests')
  await expect(main.getByRole('link', { name: /Budget/ })).toHaveAttribute('href', '/admin/budget')
})

test('guest admin traffic redirects to the dashboard', async ({ page }) => {
  await mockCurrentUser(page, guestUser)
  await mockPortalWedding(page)

  await page.goto('/admin')

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('main').getByText(/days to go/i)).toBeVisible()
})

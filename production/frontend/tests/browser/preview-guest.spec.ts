import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
  openMobileGuestNavIfPresent,
} from './fixtures/page-cleanup'

// docs/specs/VIEW_AS_GUEST_PREVIEW.md: the couple's read-only look at the
// guest experience under /preview/*. cleanupPageState() already mocks the
// portal theme, onboarding progress, notifications, party access, and the
// three Celebrate sub-feeds (blessings/music/gallery) with safe defaults --
// see fixtures/page-cleanup.ts -- so only the auth session and the
// wedding-wide portal/profile endpoints these pages actually fetch need
// mocking here.

type AuthRole = 'couple' | 'coordinator' | 'guest'

interface AuthUser {
  id: number
  name: string
  role: AuthRole
  wedding_id: number
  invite_id: number
  guest_id: number | null
}

const coupleUser: AuthUser = {
  id: 30,
  name: 'Ashley & Hazel',
  role: 'couple',
  wedding_id: 1,
  invite_id: 40,
  guest_id: null,
}

const coordinatorUser: AuthUser = {
  id: 50,
  name: 'Test Coordinator',
  role: 'coordinator',
  wedding_id: 1,
  invite_id: 60,
  guest_id: null,
}

const guestUser: AuthUser = {
  id: 10,
  name: 'Real Guest',
  role: 'guest',
  wedding_id: 1,
  invite_id: 20,
  guest_id: 10,
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

async function mockCurrentUser(page: Page, user: AuthUser) {
  await page.route('**/api/auth/me', async (route) => {
    await json(route, user)
  })
}

// Wedding-wide data every preview page (bar RSVP, which fetches nothing in
// previewMode) fetches regardless of role -- the same set Dashboard/
// Schedule/Celebrate/Wedding Party already hit for a real guest.
async function mockGuestPageApis(page: Page) {
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
  await page.route('**/api/portal/menu', async (route) => {
    await json(route, { meal_selection_open: false, options: [] })
  })
  await page.route('**/api/profiles/me', async (route) => {
    await json(route, null)
  })
  await page.route('**/api/profiles', async (route) => {
    await json(route, [])
  })
}

async function mockAdminDashboardStats(page: Page) {
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
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)
  await mockGuestPageApis(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [])
  expect(unexpectedErrors).toEqual([])
})

function mainRegion(page: Page) {
  return page.getByRole('main')
}

test('a coordinator navigating directly to a preview route is redirected to admin', async ({ page }) => {
  await mockCurrentUser(page, coordinatorUser)
  await mockAdminDashboardStats(page)

  await page.goto('/preview/dashboard')

  await expect(page).toHaveURL(/\/admin$/)
})

test('the couple sees a Preview guest view link in admin that opens the preview', async ({ page }) => {
  await mockCurrentUser(page, coupleUser)
  await mockAdminDashboardStats(page)

  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Admin Dashboard', level: 1 })).toBeVisible()

  const previewLink = page.getByRole('link', { name: 'Preview guest view' })
  await expect(previewLink).toBeVisible()
  await previewLink.click()

  await expect(page).toHaveURL(/\/preview\/dashboard$/)
  await expect(mainRegion(page).getByText(/days to go/i)).toBeVisible()
})

test('the preview banner is visible and Exit preview returns to admin', async ({ page }) => {
  await mockCurrentUser(page, coupleUser)

  await page.goto('/preview/dashboard')

  const banner = page.getByTestId('preview-banner')
  await expect(banner).toBeVisible()
  await expect(banner).toContainText("You're previewing the guest experience")

  await banner.getByRole('link', { name: 'Exit preview' }).click()
  await expect(page).toHaveURL(/\/admin$/)
})

test('clicking through preview nav tabs stays under /preview', async ({ page }) => {
  await mockCurrentUser(page, coupleUser)

  await page.goto('/preview/dashboard')
  await expect(mainRegion(page).getByText(/days to go/i)).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Guest pages' })

  // Below `sm` the nav lives behind a burger trigger that recloses on every
  // navigation (GuestLayout resets it on pathname change) -- reopen before
  // each click so this exercises both Playwright projects identically.
  await openMobileGuestNavIfPresent(page)
  await nav.getByRole('link', { name: 'RSVP' }).click()
  await expect(page).toHaveURL(/\/preview\/rsvp$/)
  await expect(page.getByTestId('preview-banner')).toBeVisible()

  await openMobileGuestNavIfPresent(page)
  await nav.getByRole('link', { name: 'Schedule' }).click()
  await expect(page).toHaveURL(/\/preview\/schedule$/)
  await expect(page.getByTestId('preview-banner')).toBeVisible()

  await openMobileGuestNavIfPresent(page)
  await nav.getByRole('link', { name: 'Celebrate' }).click()
  await expect(page).toHaveURL(/\/preview\/celebrate$/)

  await openMobileGuestNavIfPresent(page)
  await nav.getByRole('link', { name: 'Wedding Party' }).click()
  await expect(page).toHaveURL(/\/preview\/wedding-party$/)

  // Stag Do/Hen Do never appear in the preview nav -- party pages are the
  // couple's own real, already-shipped feature, not something to preview.
  await openMobileGuestNavIfPresent(page)
  await expect(nav.getByRole('link', { name: 'Stag Do' })).not.toBeVisible()
  await expect(nav.getByRole('link', { name: 'Hen Do' })).not.toBeVisible()
})

test('the RSVP preview shows a disabled sample state with no real guest fetch', async ({ page }) => {
  let guestFetchCount = 0
  await page.route(/\/api\/guests\/\d+$/, async (route) => {
    guestFetchCount += 1
    await route.fulfill({ status: 500, body: 'should never be called in preview mode' })
  })

  await mockCurrentUser(page, coupleUser)

  await page.goto('/preview/rsvp')

  const main = mainRegion(page)
  await expect(main.getByRole('heading', { name: 'RSVP' })).toBeVisible()
  await expect(main.getByText(/This is what a guest sees on their RSVP page/)).toBeVisible()

  // Every field is disabled -- this is a shell, not an interactive form.
  await expect(main.getByRole('radio', { name: 'Accept' })).toBeDisabled()
  await expect(main.getByPlaceholder('e.g. Nut allergy')).toBeDisabled()
  await expect(main.getByPlaceholder('e.g. Jamie Smith')).toBeDisabled()
  await expect(main.getByRole('button', { name: 'Save RSVP' })).toBeDisabled()

  expect(guestFetchCount).toBe(0)
})

test('a real guest session at /dashboard is unaffected by preview mode', async ({ page }) => {
  await mockCurrentUser(page, guestUser)

  await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(mainRegion(page).getByText(/days to go/i)).toBeVisible()
  await expect(page.getByTestId('preview-banner')).not.toBeVisible()
})

test('a couple session outside preview still redirects to admin on real guest routes', async ({ page }) => {
  await mockCurrentUser(page, coupleUser)
  await mockAdminDashboardStats(page)

  await page.goto('/dashboard')

  await expect(page).toHaveURL(/\/admin$/)
})

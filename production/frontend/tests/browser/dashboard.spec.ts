import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
  openMobileGuestNavIfPresent,
} from './fixtures/page-cleanup'

interface PortalWedding {
  couple_names: string
  wedding_date: string
  ceremony_time: string | null
  ceremony_location: string | null
  reception_location: string | null
  phase: string
}

const wedding: PortalWedding = {
  couple_names: 'Ashley & Hazel',
  wedding_date: '2026-09-12',
  ceremony_time: '15:30',
  ceremony_location: 'Rosewood Chapel',
  reception_location: 'The Grand Hall',
  phase: 'live',
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

async function installPortalApi(page: Page, body: PortalWedding | { detail: string }, status = 200) {
  await page.route('**/api/portal/wedding', async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, body, status)
      return
    }
    await json(route, { detail: 'Not found' }, 404)
  })
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)

  await page.route('**/api/auth/me', async (route) => {
    await json(route, {
      id: 9,
      name: 'Wedding Guest',
      role: 'guest',
      wedding_id: 1,
      invite_id: 3,
      guest_id: 42,
      wedding_phase: 'live',
    })
  })
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [
    'the server responded with a status of 500',
  ])
  expect(unexpectedErrors).toEqual([])
})

function mainRegion(page: Page) {
  return page.getByRole('main')
}

test('renders the welcome, countdown and key details', async ({ page }) => {
  await installPortalApi(page, { ...wedding })
  await page.goto('/dashboard')

  // The invitation hero greets the guest by first name (mocked "Wedding Guest")
  await expect(page.getByRole('heading', { name: 'Welcome, Wedding' })).toBeVisible()
  await expect(mainRegion(page).getByText('You are warmly invited')).toBeVisible()
  await expect(mainRegion(page).getByText(/to go|Today is the day|has passed/)).toBeVisible()
  await expect(mainRegion(page).getByText('Rosewood Chapel')).toBeVisible()
  await expect(mainRegion(page).getByText('The Grand Hall')).toBeVisible()
})

test('shows quick links to the other portal pages', async ({ page }) => {
  await installPortalApi(page, { ...wedding })
  await page.goto('/dashboard')

  const quickLinks = page.getByRole('region', { name: 'Quick links' })
  await expect(quickLinks.getByRole('link', { name: /RSVP/ })).toHaveAttribute('href', '/rsvp')
  await expect(quickLinks.getByRole('link', { name: /Schedule/ })).toHaveAttribute(
    'href',
    '/schedule',
  )
  await expect(quickLinks.getByRole('link', { name: /Blessings/ })).toHaveAttribute(
    'href',
    '/blessings',
  )
  await expect(quickLinks.getByRole('link', { name: /Dancefloor/ })).toHaveAttribute(
    'href',
    '/music',
  )
  await expect(quickLinks.getByRole('link', { name: /Gallery/ })).toHaveAttribute(
    'href',
    '/gallery',
  )
})

test('every guest page is reachable from the header nav', async ({ page }) => {
  await installPortalApi(page, { ...wedding })
  await page.goto('/dashboard')

  // Every page must stay reachable at any viewport (it previously clipped
  // Dancefloor + Gallery behind an overflow scroller on phones). On mobile
  // that's now via the burger menu (see GuestLayout.tsx) rather than a
  // directly-visible row -- open it first so this assertion holds on both
  // projects.
  await openMobileGuestNavIfPresent(page)
  const nav = page.getByRole('navigation', { name: 'Guest pages' })
  for (const label of ['Dashboard', 'RSVP', 'Schedule', 'Blessings', 'Dancefloor', 'Gallery']) {
    await expect(nav.getByRole('link', { name: label })).toBeInViewport()
  }
})

test('nudges the guest with the onboarding checklist when items remain', async ({ page }) => {
  await installPortalApi(page, { ...wedding })
  // Overrides the all-done default from cleanupPageState (later routes win).
  await page.route('**/api/portal/me/progress', async (route) => {
    await json(route, {
      rsvp_submitted: false,
      song_requested: true,
      photo_submitted: true,
      blessing_posted: true,
    })
  })
  await page.goto('/dashboard')

  const card = page.getByTestId('onboarding-checklist')
  await expect(card).toBeVisible()
  await expect(card.getByText("3 of 4 done — you haven't RSVP'd yet 💌")).toBeVisible()
  await expect(card.getByRole('link', { name: 'RSVP now' })).toHaveAttribute('href', '/rsvp')
})

test('shows a skeleton while the wedding details load', async ({ page }) => {
  await page.route('**/api/portal/wedding', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700))
    await json(route, { ...wedding })
  })
  await page.goto('/dashboard')

  // While loading, the dashboard renders a shimmer skeleton (not plain text)
  const status = mainRegion(page).getByRole('status')
  await expect(status).toBeVisible()
  await expect(status.locator('.animate-pulse').first()).toBeVisible()

  // ...which resolves into the real hero once the wedding arrives
  await expect(page.getByRole('heading', { name: 'Welcome, Wedding' })).toBeVisible()
  await expect(status).not.toBeVisible()
})

test('shows an error state when the wedding fails to load', async ({ page }) => {
  await installPortalApi(page, { detail: 'Boom' }, 500)
  await page.goto('/dashboard')

  await expect(mainRegion(page).getByRole('alert')).toBeVisible()
})

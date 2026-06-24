import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
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

  await expect(
    page.getByRole('heading', { name: "Welcome to Ashley & Hazel's wedding" }),
  ).toBeVisible()
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
  await expect(quickLinks.getByRole('link', { name: /Gallery/ })).toHaveAttribute(
    'href',
    '/gallery',
  )
})

test('shows an error state when the wedding fails to load', async ({ page }) => {
  await installPortalApi(page, { detail: 'Boom' }, 500)
  await page.goto('/dashboard')

  await expect(mainRegion(page).getByRole('alert')).toBeVisible()
})

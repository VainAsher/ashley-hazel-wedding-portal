import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

/**
 * ROADMAP item 18 (docs/specs/PAGE_BACKGROUNDS.md): per-page background
 * photo + focal point/zoom. This suite covers the GuestLayout/AuthLayout
 * consumption half (PR 2/3) -- the admin picker UI (PR 3/3) is covered
 * separately once it exists. Values are asserted directly off the backdrop's
 * inline style (data-testid="guest-backdrop-photo"), not screenshot-diffed.
 */

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

function themeWithPageBackgrounds(pageBackgrounds: Record<string, unknown>) {
  return {
    theme: {
      primary: '#f6c445',
      secondary: '#2b064d',
      tint_opacity: 0.9,
      display_font: 'Georgia',
      body_font: 'Inter',
      type_scale: 1.0,
      layout_mode: 'scroll',
      page_backgrounds: pageBackgrounds,
    },
  }
}

function backdropPhoto(page: Page) {
  return page.getByTestId('guest-backdrop-photo')
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors)
  expect(unexpectedErrors).toEqual([])
})

test.describe('guest pages, no customization (regression: unchanged today)', () => {
  test('an uncustomized wedding renders the same stock photo at centered, unzoomed', async ({
    page,
  }) => {
    await page.route('**/api/auth/me', (route) =>
      json(route, {
        id: 9,
        name: 'Wedding Guest',
        role: 'guest',
        wedding_id: 1,
        invite_id: 3,
        guest_id: 42,
      }),
    )
    await page.route('**/api/portal/theme', (route) =>
      json(route, themeWithPageBackgrounds({})),
    )
    await page.route('**/api/portal/wedding', (route) =>
      json(route, {
        couple_names: 'Ashley & Hazel',
        wedding_date: '2027-06-19',
        ceremony_time: '12:00:00',
        ceremony_location: 'The Chapel',
        reception_location: 'The Hall',
        phase: 'live',
      }),
    )

    await page.goto('/dashboard')

    const photo = backdropPhoto(page)
    await expect(photo).toHaveCSS(
      'background-image',
      /bg-02-registry-office\.jpg/,
    )
    await expect(photo).toHaveCSS('background-position', '50% 50%')
    await expect(photo).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)') // scale(1) === identity
  })
})

test.describe('guest pages, customized background', () => {
  test('a customized page renders the configured photo at its focal point and zoom', async ({
    page,
  }) => {
    await page.route('**/api/auth/me', (route) =>
      json(route, {
        id: 9,
        name: 'Wedding Guest',
        role: 'guest',
        wedding_id: 1,
        invite_id: 3,
        guest_id: 42,
      }),
    )
    await page.route('**/api/portal/theme', (route) =>
      json(
        route,
        themeWithPageBackgrounds({
          dashboard: {
            source: 'stock',
            url: '/backgrounds/bg-05-evening-sky.jpg',
            focal_x: 32.4,
            focal_y: 68.1,
            zoom: 1.6,
          },
        }),
      ),
    )
    await page.route('**/api/portal/wedding', (route) =>
      json(route, {
        couple_names: 'Ashley & Hazel',
        wedding_date: '2027-06-19',
        ceremony_time: '12:00:00',
        ceremony_location: 'The Chapel',
        reception_location: 'The Hall',
        phase: 'live',
      }),
    )

    await page.goto('/dashboard')

    const photo = backdropPhoto(page)
    await expect(photo).toHaveCSS('background-image', /bg-05-evening-sky\.jpg/)
    await expect(photo).toHaveCSS('background-position', '32.4% 68.1%')
    await expect(photo).toHaveCSS('transform', 'matrix(1.6, 0, 0, 1.6, 0, 0)')
  })

  test('an uncustomized page on the same wedding still falls back to its own stock default', async ({
    page,
  }) => {
    await page.route('**/api/auth/me', (route) =>
      json(route, {
        id: 9,
        name: 'Wedding Guest',
        role: 'guest',
        wedding_id: 1,
        invite_id: 3,
        guest_id: 42,
      }),
    )
    // Only dashboard is customized -- schedule must resolve independently,
    // not inherit dashboard's photo.
    await page.route('**/api/portal/theme', (route) =>
      json(
        route,
        themeWithPageBackgrounds({
          dashboard: {
            source: 'stock',
            url: '/backgrounds/bg-05-evening-sky.jpg',
            focal_x: 32.4,
            focal_y: 68.1,
            zoom: 1.6,
          },
        }),
      ),
    )
    await page.route('**/api/portal/schedule', (route) => json(route, []))
    await page.route('**/api/portal/menu', (route) =>
      json(route, { meal_selection_open: false, options: [] }),
    )

    await page.goto('/schedule')

    const photo = backdropPhoto(page)
    await expect(photo).toHaveCSS('background-image', /bg-04-woodland-walk\.jpg/)
    await expect(photo).toHaveCSS('background-position', '50% 50%')
  })
})

test.describe('pre-login invite/landing page', () => {
  test('an uncustomized invite background matches the current stock default, unauthenticated', async ({
    page,
  }) => {
    await page.route('**/api/portal/theme', (route) =>
      json(route, themeWithPageBackgrounds({})),
    )

    await page.goto('/invite')

    const photo = backdropPhoto(page)
    await expect(photo).toHaveCSS('background-image', /bg-06-registry-candid\.jpg/)
  })

  test('a configured invite background renders with no authentication', async ({ page }) => {
    await page.route('**/api/portal/theme', (route) =>
      json(
        route,
        themeWithPageBackgrounds({
          invite: {
            source: 'gallery',
            url: '/uploads/1/gallery/abc123.jpg',
            focal_x: 20,
            focal_y: 80,
            zoom: 1.3,
          },
        }),
      ),
    )

    await page.goto('/invite')

    const photo = backdropPhoto(page)
    await expect(photo).toHaveCSS('background-image', /abc123\.jpg/)
    await expect(photo).toHaveCSS('background-position', '20% 80%')
    await expect(photo).toHaveCSS('transform', 'matrix(1.3, 0, 0, 1.3, 0, 0)')
  })
})

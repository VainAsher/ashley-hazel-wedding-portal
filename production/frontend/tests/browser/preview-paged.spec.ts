import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

// Phase 0 viewport-paging spike (Wave 4 item 17,
// docs/specs/VIEWPORT_PAGING_SPIKE.md). /preview is a throwaway,
// admin-gated prototype route that renders the real Dashboard/RSVP/
// Schedule/Blessings pages (unmodified) inside a horizontal swipeable deck.

interface AuthUser {
  id: number
  name: string
  role: 'guest' | 'coordinator' | 'couple'
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

const coordinatorUser: AuthUser = {
  id: 50,
  name: 'Coordinator Preview',
  role: 'coordinator',
  wedding_id: 1,
  invite_id: 60,
  guest_id: null,
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
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

// Minimal API doubles for the 4 pages the deck renders -- each page is
// reused exactly as it runs on its own route, so it makes its own real
// calls; the deck itself makes none.
async function mockPreviewPageApis(page: Page) {
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
  await page.route('**/api/blessings', async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, [])
      return
    }
    await json(route, { detail: 'Not found' }, 404)
  })
  await page.route('**/api/mentions/directory*', async (route) => {
    await json(route, [])
  })
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [
    // The coordinator/couple preview account has no guest_id, so RSVP's own
    // (unmodified) guard throws a client-side 403 it displays as an alert --
    // expected, pre-existing behaviour for any non-guest viewing /rsvp.
    'the server responded with a status of 403',
  ])
  expect(unexpectedErrors).toEqual([])
})

test('guest session is redirected away from /preview, same as any other admin route', async ({
  page,
}) => {
  await mockCurrentUser(page, guestUser)
  await mockPreviewPageApis(page)

  await page.goto('/preview')

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('main').getByText(/days to go/i)).toBeVisible()
})

test('shows the prototype-only banner', async ({ page }) => {
  await mockCurrentUser(page, coordinatorUser)
  await mockPreviewPageApis(page)

  await page.goto('/preview')

  await expect(page.getByText('Prototype — internal review only')).toBeVisible()
})

test('arrow buttons, keyboard, and aria-live walk through all 4 pages', async ({ page }) => {
  await mockCurrentUser(page, coordinatorUser)
  await mockPreviewPageApis(page)

  await page.goto('/preview')

  const announcer = page.getByTestId('paged-deck-announcer')
  const dashboardSlide = page.getByTestId('paged-deck-slide-dashboard')
  const rsvpSlide = page.getByTestId('paged-deck-slide-rsvp')
  const scheduleSlide = page.getByTestId('paged-deck-slide-schedule')
  const blessingsSlide = page.getByTestId('paged-deck-slide-blessings')

  // Starts on Dashboard (page 1 of 4).
  await expect(dashboardSlide).toBeInViewport()
  await expect(announcer).toHaveText('Page 1 of 4: Dashboard')

  // Arrow button: Dashboard -> RSVP.
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(rsvpSlide).toBeInViewport()
  await expect(announcer).toHaveText('Page 2 of 4: RSVP')

  // Arrow button: RSVP -> Schedule.
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(scheduleSlide).toBeInViewport()
  await expect(announcer).toHaveText('Page 3 of 4: Schedule')

  // Keyboard: Schedule -> Blessings.
  await page.keyboard.press('ArrowRight')
  await expect(blessingsSlide).toBeInViewport()
  await expect(announcer).toHaveText('Page 4 of 4: Blessings')

  // The "next" arrow is gone on the last page.
  await expect(page.getByRole('button', { name: 'Next page' })).toHaveCount(0)

  // Keyboard: Blessings -> Schedule.
  await page.keyboard.press('ArrowLeft')
  await expect(scheduleSlide).toBeInViewport()
  await expect(announcer).toHaveText('Page 3 of 4: Schedule')

  // Arrow button: Schedule -> RSVP.
  await page.getByRole('button', { name: 'Previous page' }).click()
  await expect(rsvpSlide).toBeInViewport()
  await expect(announcer).toHaveText('Page 2 of 4: RSVP')

  // Keyboard: RSVP -> Dashboard.
  await page.keyboard.press('ArrowLeft')
  await expect(dashboardSlide).toBeInViewport()
  await expect(announcer).toHaveText('Page 1 of 4: Dashboard')

  // The "previous" arrow is gone on the first page.
  await expect(page.getByRole('button', { name: 'Previous page' })).toHaveCount(0)
})

test('reduced motion: the deck jumps instead of smooth-scrolling', async ({ page }) => {
  await mockCurrentUser(page, coordinatorUser)
  await mockPreviewPageApis(page)

  // Known Playwright gotcha in this repo (v1.44.1): test.use({ reducedMotion })
  // does not reach the page -- page.emulateMedia() must be used instead.
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.goto('/preview')

  const deck = page.getByTestId('paged-deck')
  const scrollBehavior = await deck.evaluate(
    (element) => window.getComputedStyle(element).scrollBehavior,
  )
  expect(scrollBehavior).toBe('auto')
})

test('without reduced motion, the deck uses smooth scrolling', async ({ page }) => {
  await mockCurrentUser(page, coordinatorUser)
  await mockPreviewPageApis(page)

  await page.emulateMedia({ reducedMotion: 'no-preference' })

  await page.goto('/preview')

  const deck = page.getByTestId('paged-deck')
  const scrollBehavior = await deck.evaluate(
    (element) => window.getComputedStyle(element).scrollBehavior,
  )
  expect(scrollBehavior).toBe('smooth')
})

// Couple feedback (2026-07-13): mobile should get a burger menu instead of
// the live nav's wrap-to-second-row treatment, and the desktop composition
// should compress each page closer to one viewport. Both viewports are set
// explicitly here (rather than relying on the project's device) so these
// assertions are deterministic regardless of which project runs them.

test('mobile: the live per-page nav is hidden and a burger menu takes over', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockCurrentUser(page, coordinatorUser)
  await mockPreviewPageApis(page)

  await page.goto('/preview')

  // All 4 pages stay mounted (one nav per page), so scope to the active
  // (Dashboard) slide specifically rather than an ambiguous page-wide query.
  // The nav row rendered by each embedded page's own (unmodified)
  // GuestLayout is hidden at mobile widths -- CSS scoped to this route
  // only, per the spec's "don't touch GuestLayout" rule.
  await expect(
    page.getByTestId('paged-deck-slide-dashboard').getByRole('navigation', { name: 'Guest pages' }),
  ).toBeHidden()

  const burgerButton = page.getByRole('button', { name: 'Open page menu' })
  await expect(burgerButton).toBeVisible()

  await burgerButton.click()
  const menu = page.getByRole('menu', { name: 'Preview pages' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem')).toHaveCount(4)

  const announcer = page.getByTestId('paged-deck-announcer')
  await menu.getByRole('menuitem', { name: 'Schedule' }).click()
  await expect(page.getByTestId('paged-deck-slide-schedule')).toBeInViewport()
  await expect(announcer).toHaveText('Page 3 of 4: Schedule')
  // The menu closes itself after a selection.
  await expect(menu).toBeHidden()
})

test('desktop: the burger menu is not shown and the live nav stays visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mockCurrentUser(page, coordinatorUser)
  await mockPreviewPageApis(page)

  await page.goto('/preview')

  // Scope to the active (Dashboard) slide -- all 4 pages stay mounted, each
  // with its own nav, so an unscoped query is ambiguous.
  await expect(
    page.getByTestId('paged-deck-slide-dashboard').getByRole('navigation', { name: 'Guest pages' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open page menu' })).toBeHidden()
})

test('the dot page indicator in the banner tracks the current page', async ({ page }) => {
  await mockCurrentUser(page, coordinatorUser)
  await mockPreviewPageApis(page)

  await page.goto('/preview')

  const banner = page.getByRole('status')
  const dots = banner.locator('span.rounded-full')
  await expect(dots).toHaveCount(4)
  await expect(dots.nth(0)).toHaveClass(/bg-black(?!\/)/)

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByTestId('paged-deck-slide-rsvp')).toBeInViewport()
  await expect(dots.nth(1)).toHaveClass(/bg-black(?!\/)/)
  await expect(dots.nth(0)).toHaveClass(/bg-black\/25/)
})

test('FeedbackWidget stays viewport-fixed on every mounted page', async ({ page }) => {
  // Regression test: an earlier version of the auto-fit-to-viewport scaling
  // applied `transform: scale()` to each ENTIRE embedded page (not just its
  // <main>), which makes that scaled ancestor the CSS containing block for
  // any `position: fixed` descendant -- GuestLayout's floating Feedback
  // button stopped resolving "fixed" against the real viewport and visibly
  // detached to a second position while off-screen (caught in couple
  // review as two "Feedback" pills painting at different spots at once).
  // Scaling is now scoped to <main> only, a sibling of the widget in
  // GuestLayout, so every one of the 4 mounted copies (one per page, all
  // stay mounted per the inert design) must resolve to the exact same real
  // viewport position -- not a DOM-count check, since 4 mounted copies are
  // expected by design.
  await mockCurrentUser(page, coordinatorUser)
  await mockPreviewPageApis(page)

  await page.goto('/preview')

  const feedbackButtons = page.getByRole('button', { name: /feedback/i })
  await expect(feedbackButtons).toHaveCount(4)

  const positions = await feedbackButtons.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { x: Math.round(rect.x), y: Math.round(rect.y) }
    }),
  )
  for (const position of positions.slice(1)) {
    expect(position).toEqual(positions[0])
  }
})

test('mobile: auto-fit shrinking is disabled, content keeps full width', async ({ page }) => {
  // Regression test: CSS `transform: scale()` shrinks width and height by
  // the SAME factor. On a narrow phone viewport, compressing height enough
  // to fit also compresses width down to a thin column with big empty side
  // margins (caught in couple review: "content margins seem quite large
  // ... small thin area in the middle"). The desktop single-viewport ask
  // never applied to mobile in the first place, so FitToSlide now skips
  // scaling below the same breakpoint used for the burger-menu switch.
  await page.setViewportSize({ width: 390, height: 844 })
  await mockCurrentUser(page, coordinatorUser)
  await mockPreviewPageApis(page)

  await page.goto('/preview')

  const dashboardSlide = page.getByTestId('paged-deck-slide-dashboard')
  const main = dashboardSlide.locator('main')
  const mainWidth = await main.evaluate((element) => element.getBoundingClientRect().width)
  // Full viewport width, not shrunk toward MIN_FIT_SCALE (~62%).
  expect(mainWidth).toBeGreaterThan(370)

  const transform = await main.evaluate((element) => window.getComputedStyle(element).transform)
  expect(transform).toBe('none')
})

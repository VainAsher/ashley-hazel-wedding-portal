import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

// Wave 4 item 17 Phase 1 (docs/specs/VIEWPORT_PAGING_PHASE1.md): the real,
// guest-facing rollout of viewport-fit paged navigation for
// Dashboard/RSVP/Schedule/Blessings, replacing the throwaway admin-only
// /preview spike (docs/specs/VIEWPORT_PAGING_SPIKE.md, now deleted). These
// tests cover paged mode specifically; scroll mode (layout_mode: 'scroll',
// the regression backstop proving today's behaviour is untouched) is
// covered by the existing dashboard/rsvp/schedule/blessings specs run
// unmodified -- see fixtures/page-cleanup.ts's default theme mock.

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
  name: 'Paged Guest',
  role: 'guest',
  wedding_id: 1,
  invite_id: 20,
  guest_id: 10,
}

const coordinatorUser: AuthUser = {
  id: 50,
  name: 'Paged Coordinator',
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

async function mockCurrentUser(page: Page, user: AuthUser) {
  await page.route('**/api/auth/me', async (route) => {
    await json(route, user)
  })
}

function pagedTheme(layoutMode: 'paged' | 'scroll' = 'paged') {
  return {
    theme: {
      primary: '#f6c445',
      secondary: '#2b064d',
      tint_opacity: 0.9,
      display_font: 'Georgia',
      body_font: 'Inter',
      type_scale: 1.0,
      layout_mode: layoutMode,
    },
  }
}

// Minimal API doubles for the 4 pages the deck mounts together -- each page
// is the real, unmodified *Content component, so it makes its own real
// calls; PagedGuestDeck itself makes none.
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
  await page.route(/\/api\/guests\/10$/, async (route) => {
    await json(route, {
      id: 10,
      wedding_id: 1,
      name: 'Paged Guest',
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
      plus_one_meal_choice: null,
      table_number: null,
      seat_number: null,
      notes: null,
      created_at: null,
      updated_at: null,
    })
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
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [])
  expect(unexpectedErrors).toEqual([])
})

test.describe('deep links land on the correct slide with no visible jump', () => {
  const cases: Array<{ path: string; label: string; slideId: string }> = [
    { path: '/dashboard', label: 'Dashboard', slideId: 'dashboard' },
    { path: '/rsvp', label: 'RSVP', slideId: 'rsvp' },
    { path: '/schedule', label: 'Schedule', slideId: 'schedule' },
    { path: '/blessings', label: 'Blessings', slideId: 'blessings' },
  ]

  for (const { path, label, slideId } of cases) {
    test(`deep link to ${path} mounts already scrolled to ${label}`, async ({ page }) => {
      await mockCurrentUser(page, guestUser)
      await mockGuestPageApis(page)
      await page.route('**/api/portal/theme', (route) => json(route, pagedTheme('paged')))

      await page.goto(path)

      const announcer = page.getByTestId('paged-deck-announcer')
      await expect(announcer).toHaveText(new RegExp(`of 4: ${label}$`))
      await expect(page.getByTestId(`paged-deck-slide-${slideId}`)).toBeInViewport()
      await expect(page.getByTestId('paged-current-page-name').first()).toHaveText(label)
    })
  }
})

test('arrow buttons, keyboard, and aria-live walk through all 4 pages with URL sync via replace', async ({
  page,
}) => {
  await mockCurrentUser(page, guestUser)
  await mockGuestPageApis(page)
  await page.route('**/api/portal/theme', (route) => json(route, pagedTheme('paged')))

  await page.goto('/dashboard')

  const announcer = page.getByTestId('paged-deck-announcer')
  await expect(announcer).toHaveText('Page 1 of 4: Dashboard')
  await expect(page).toHaveURL(/\/dashboard$/)

  const historyLengthBeforeSwiping = await page.evaluate(() => window.history.length)

  // Arrow button: Dashboard -> RSVP.
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByTestId('paged-deck-slide-rsvp')).toBeInViewport()
  await expect(announcer).toHaveText('Page 2 of 4: RSVP')
  await expect(page).toHaveURL(/\/rsvp$/)

  // Arrow button: RSVP -> Schedule.
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByTestId('paged-deck-slide-schedule')).toBeInViewport()
  await expect(announcer).toHaveText('Page 3 of 4: Schedule')
  await expect(page).toHaveURL(/\/schedule$/)

  // Keyboard: Schedule -> Blessings.
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('paged-deck-slide-blessings')).toBeInViewport()
  await expect(announcer).toHaveText('Page 4 of 4: Blessings')
  await expect(page).toHaveURL(/\/blessings$/)

  // The "next" arrow is gone on the last page.
  await expect(page.getByRole('button', { name: 'Next page' })).toHaveCount(0)

  // Keyboard: Blessings -> Schedule.
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('paged-deck-slide-schedule')).toBeInViewport()
  await expect(page).toHaveURL(/\/schedule$/)

  // Arrow button: Schedule -> RSVP.
  await page.getByRole('button', { name: 'Previous page' }).click()
  await expect(page.getByTestId('paged-deck-slide-rsvp')).toBeInViewport()
  await expect(page).toHaveURL(/\/rsvp$/)

  // Keyboard: RSVP -> Dashboard.
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('paged-deck-slide-dashboard')).toBeInViewport()
  await expect(page).toHaveURL(/\/dashboard$/)

  // The "previous" arrow is gone on the first page.
  await expect(page.getByRole('button', { name: 'Previous page' })).toHaveCount(0)

  // Every URL change above happened via navigate(path, { replace: true }) --
  // none of that swiping should have grown the browser history stack.
  const historyLengthAfterSwiping = await page.evaluate(() => window.history.length)
  expect(historyLengthAfterSwiping).toBe(historyLengthBeforeSwiping)
})

test('the back button leaves the paged group entirely instead of stepping through pages', async ({
  page,
}) => {
  await mockCurrentUser(page, guestUser)
  await mockGuestPageApis(page)
  await page.route('**/api/portal/theme', (route) => json(route, pagedTheme('paged')))

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard$/)

  // A real nav-link click is a normal (push) navigation -- one new history
  // entry, same as any other route change in the app.
  await page.getByRole('navigation', { name: 'Guest pages' }).getByRole('link', { name: 'Blessings' }).click()
  await expect(page).toHaveURL(/\/blessings$/)
  await expect(page.getByTestId('paged-deck-slide-blessings')).toBeInViewport()

  // Swiping backward through Schedule and RSVP uses replace, not push.
  await page.getByRole('button', { name: 'Previous page' }).click()
  await expect(page).toHaveURL(/\/schedule$/)
  await page.getByRole('button', { name: 'Previous page' }).click()
  await expect(page).toHaveURL(/\/rsvp$/)

  // One back() undoes the single push (Dashboard -> Blessings), landing
  // straight back on Dashboard -- not stepping through Schedule/RSVP, which
  // were never real history entries.
  await page.goBack()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('reduced motion: the deck jumps instead of smooth-scrolling', async ({ page }) => {
  await mockCurrentUser(page, guestUser)
  await mockGuestPageApis(page)
  await page.route('**/api/portal/theme', (route) => json(route, pagedTheme('paged')))

  // Known Playwright gotcha in this repo: test.use({ reducedMotion }) does
  // not reach the page -- page.emulateMedia() must be used instead.
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await page.goto('/dashboard')

  const deck = page.getByTestId('paged-deck')
  const scrollBehavior = await deck.evaluate(
    (element) => window.getComputedStyle(element).scrollBehavior,
  )
  expect(scrollBehavior).toBe('auto')
})

test('without reduced motion, the deck uses smooth scrolling', async ({ page }) => {
  await mockCurrentUser(page, guestUser)
  await mockGuestPageApis(page)
  await page.route('**/api/portal/theme', (route) => json(route, pagedTheme('paged')))

  await page.emulateMedia({ reducedMotion: 'no-preference' })

  await page.goto('/dashboard')

  const deck = page.getByTestId('paged-deck')
  const scrollBehavior = await deck.evaluate(
    (element) => window.getComputedStyle(element).scrollBehavior,
  )
  expect(scrollBehavior).toBe('smooth')
})

test('the header dot indicator tracks the current page and is absent in scroll mode', async ({
  page,
}) => {
  // The named indicator (page name + dots) lives in the header's top row,
  // which is `hidden sm:flex` -- too tight below the `sm` breakpoint, same
  // reasoning as the rest of that row (see GuestLayout.tsx). Mobile gets its
  // own dots-only indicator in the nav row instead (covered separately
  // below). Pin desktop width here so this test isn't at the mercy of
  // whichever project happens to run it.
  await page.setViewportSize({ width: 1280, height: 900 })
  await mockCurrentUser(page, guestUser)
  await mockGuestPageApis(page)
  await page.route('**/api/portal/theme', (route) => json(route, pagedTheme('paged')))

  await page.goto('/dashboard')

  const indicator = page.getByTestId('paged-nav-indicator')
  await expect(indicator).toBeVisible()
  await expect(page.getByTestId('paged-current-page-name').first()).toHaveText('Dashboard')

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByTestId('paged-current-page-name').first()).toHaveText('RSVP')
})

test('scroll mode: no deck, no header indicator -- today\'s normal scrolling page', async ({
  page,
}) => {
  await mockCurrentUser(page, guestUser)
  await mockGuestPageApis(page)
  await page.route('**/api/portal/theme', (route) => json(route, pagedTheme('scroll')))

  await page.goto('/dashboard')

  await expect(page.getByTestId('paged-deck')).toHaveCount(0)
  await expect(page.getByTestId('paged-nav-indicator')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
})

test('inert is applied to off-screen slides so Tab does not leak into them', async ({ page }) => {
  await mockCurrentUser(page, guestUser)
  await mockGuestPageApis(page)
  await page.route('**/api/portal/theme', (route) => json(route, pagedTheme('paged')))

  await page.goto('/dashboard')

  await expect(page.getByTestId('paged-deck-slide-dashboard')).not.toHaveAttribute('inert', '')
  await expect(page.getByTestId('paged-deck-slide-rsvp')).toHaveAttribute('inert', '')
  await expect(page.getByTestId('paged-deck-slide-schedule')).toHaveAttribute('inert', '')
  await expect(page.getByTestId('paged-deck-slide-blessings')).toHaveAttribute('inert', '')

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page.getByTestId('paged-deck-slide-rsvp')).toBeInViewport()

  await expect(page.getByTestId('paged-deck-slide-dashboard')).toHaveAttribute('inert', '')
  await expect(page.getByTestId('paged-deck-slide-rsvp')).not.toHaveAttribute('inert', '')
})

test('mobile: the arrow buttons stay permanently visible, not just during the swipe hint', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockCurrentUser(page, guestUser)
  await mockGuestPageApis(page)
  await page.route('**/api/portal/theme', (route) => json(route, pagedTheme('paged')))

  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Next page' }).click()

  const nextButton = page.getByRole('button', { name: 'Next page' })
  await expect(nextButton).toHaveCSS('opacity', '1')

  // Past the swipe hint's ~3.2s fade window -- arrows must still be visible.
  await page.waitForTimeout(3500)
  await expect(nextButton).toHaveCSS('opacity', '1')
  await expect(page.getByRole('button', { name: 'Previous page' })).toHaveCSS('opacity', '1')
})

test.describe('the settings toggle switches a live session without a reload', () => {
  test('saving guest page navigation immediately refetches the shared theme query', async ({
    page,
  }) => {
    await mockCurrentUser(page, coordinatorUser)

    let currentLayoutMode: 'paged' | 'scroll' = 'paged'
    let themeRequestCount = 0
    await page.route('**/api/portal/theme', async (route) => {
      themeRequestCount += 1
      await json(route, pagedTheme(currentLayoutMode))
    })

    let settings = {
      id: 1,
      couple_names: 'Ashley & Hazel',
      wedding_date: '2026-09-12',
      ceremony_time: null,
      ceremony_location: null,
      reception_location: null,
      phase: 'live',
      theme: null as unknown,
      meal_selection_open: false,
      party_visibility_mode: 'partner_visible',
    }
    await page.route('**/api/settings/wedding', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await json(route, settings)
        return
      }
      if (method === 'PUT') {
        const payload = route.request().postDataJSON() as { theme?: { layout_mode?: string } }
        settings = { ...settings, ...payload }
        if (payload.theme?.layout_mode) {
          currentLayoutMode = payload.theme.layout_mode as 'paged' | 'scroll'
        }
        await json(route, settings)
        return
      }
      await json(route, { detail: 'Not found' }, 404)
    })
    await page.route('**/api/menu', async (route) => {
      await json(route, [])
    })
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ body: '', contentType: 'text/css' }),
    )

    await page.goto('/admin/settings')
    await expect(page.getByRole('heading', { name: 'Guest Page Navigation' })).toBeVisible()

    const requestCountBeforeSave = themeRequestCount
    await page
      .getByRole('radiogroup', { name: 'Guest page navigation' })
      .getByRole('radio', { name: /Scroll/ })
      .click()

    await expect(
      page.getByRole('status').filter({ hasText: 'Guest page navigation saved.' }),
    ).toBeVisible()

    // ThemeApplier is mounted for the whole app session (App.tsx, outside
    // <Routes>), so it's an ACTIVE subscriber to the same theme query
    // GuestLayout reads -- invalidateQueries in useUpdateSettings's
    // onSuccess (src/hooks/useSettings.ts) refetches it immediately, with
    // no navigation and no page reload anywhere in this test.
    await expect.poll(() => themeRequestCount).toBeGreaterThan(requestCountBeforeSave)
  })
})

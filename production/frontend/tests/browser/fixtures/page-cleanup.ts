import { type Page } from '@playwright/test'

/**
 * Reset all page state and context for test isolation
 * This is called automatically by fixtures but can be used manually
 */
export async function cleanupPageState(page: Page): Promise<void> {
  try {
    // Clear all route handlers from previous tests
    // Use a wildcard pattern to match all routes
    await page.unroute('**/*').catch(() => {
      // Silently ignore if unroute fails
    })

    // ThemeApplier requests the public theme on every page. Answer it with
    // the canonical defaults so specs don't need to mock it individually (a
    // spec can still override — routes registered later win).
    //
    // layout_mode is explicitly 'scroll' here (NOT the real production
    // default of 'paged' -- see WeddingTheme in app/db/schemas.py) so every
    // existing guest-page spec keeps exercising today's normal scrolling
    // pages, completely unmodified, as the Wave 4 item 17 Phase 1 regression
    // backstop (docs/specs/VIEWPORT_PAGING_PHASE1.md). Paged-mode specs
    // (paged-guest-deck.spec.ts) register their own theme route with
    // layout_mode: 'paged', which wins over this default.
    await page.route('**/api/portal/theme', (route) =>
      route.fulfill({
        body: JSON.stringify({
          theme: {
            primary: '#f6c445',
            secondary: '#2b064d',
            tint_opacity: 0.9,
            display_font: 'Georgia',
            body_font: 'Inter',
            type_scale: 1.0,
            layout_mode: 'scroll',
          },
        }),
        contentType: 'application/json',
        status: 200,
      }),
    )

    // The guest dashboard fetches onboarding progress. Default to "all done"
    // so the checklist card stays out of every other spec's way (and no spec
    // trips over an unmocked 404 console error). onboarding.spec.ts registers
    // its own route, which wins over this one.
    await page.route('**/api/portal/me/progress', (route) =>
      route.fulfill({
        body: JSON.stringify({
          rsvp_submitted: true,
          song_requested: true,
          photo_submitted: true,
          blessing_posted: true,
        }),
        contentType: 'application/json',
        status: 200,
      }),
    )

    // The notifications bell (guest + admin headers) fetches this on every
    // page. Default to "no notifications" so specs stay console-error-free;
    // notification specs register their own route later, which wins.
    await page.route('**/api/notifications', (route) =>
      route.fulfill({
        body: JSON.stringify({ items: [], unread_count: 0 }),
        contentType: 'application/json',
        status: 200,
      }),
    )

    // GuestLayout fetches this on every guest page to decide whether to show
    // the Stag Do / Hen Do nav links (Wave 3 item 14 D1). Default to "no
    // access" so specs stay console-error-free and don't see nav entries
    // they didn't ask for; party.spec.ts registers its own route, which wins.
    await page.route('**/api/party/access', (route) =>
      route.fulfill({
        body: JSON.stringify({ stag: false, hen: false }),
        contentType: 'application/json',
        status: 200,
      }),
    )

    // Clear cookies and local storage
    await page.context().clearCookies()
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    }).catch(() => {
      // Ignore errors if page isn't loaded yet
    })

    // Pre-seed the envelope-reveal flag before every navigation so the
    // invite page renders the open invitation card immediately. Specs that
    // exercise the envelope itself (envelope-reveal.spec.ts) skip this
    // helper and manage the flag themselves.
    await page.addInitScript(() => {
      try {
        window.sessionStorage.setItem('ah-envelope-opened', '1')
        // Likewise pre-mark the one-time nav coach mark as seen so it never
        // floats over other specs' pages. onboarding.spec.ts manages this
        // flag itself to exercise the first-visit hint.
        window.localStorage.setItem('ah-nav-hint-seen', '1')
      } catch {
        // Storage unavailable: the app treats this as a first visit.
      }
    })

    // Reset browserErrors tracking
    Reflect.deleteProperty(page, 'browserErrors')
  } catch (error) {
    // Silently ignore cleanup errors
  }
}

/**
 * Initialize error tracking on page for test validation
 * Returns the browserErrors array for custom filtering if needed
 */
export async function initializeErrorTracking(page: Page): Promise<string[]> {
  const browserErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text())
    }
  })

  page.on('pageerror', (error) => {
    browserErrors.push(error.message)
  })

  // Store on page for afterEach access
  Reflect.set(page, 'browserErrors', browserErrors)

  return browserErrors
}

/**
 * Get tracked browser errors from page
 */
export function getBrowserErrors(page: Page): string[] {
  return (Reflect.get(page, 'browserErrors') as string[] | undefined) ?? []
}

/**
 * Filter out expected/ignorable errors
 */
export function filterIgnorableErrors(
  errors: string[],
  ignoredPatterns: string[] = [],
): string[] {
  const defaultIgnored = [
    'the server responded with a status of 401',
    'the server responded with a status of 400',
    'net::ERR_FAILED',
    'Write permission denied', // Clipboard API not available in headless
  ]

  const allIgnored = [...defaultIgnored, ...ignoredPatterns]

  return errors.filter((message) =>
    !allIgnored.some((ignored) => message.includes(ignored))
  )
}

import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

/**
 * Progressive onboarding (Wave 2 item 10): the dashboard checklist card,
 * the one-time nav coach mark, and the footer "How this works" dialog.
 */

const HINT_KEY = 'ah-nav-hint-seen'

interface Progress {
  rsvp_submitted: boolean
  song_requested: boolean
  photo_submitted: boolean
  blessing_posted: boolean
}

const wedding = {
  couple_names: 'Ashley & Hazel',
  wedding_date: '2027-06-19',
  ceremony_time: '14:00',
  ceremony_location: 'Halifax Minster',
  reception_location: 'The Arches',
  phase: 'live',
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

async function installGuestBackend(page: Page, progress: Progress) {
  await page.route('**/api/auth/me', (route) =>
    json(route, {
      id: 9,
      name: 'Wedding Guest',
      role: 'guest',
      wedding_id: 1,
      invite_id: 3,
      guest_id: 42,
      wedding_phase: 'live',
    }),
  )
  await page.route('**/api/portal/wedding', (route) => json(route, wedding))
  await page.route('**/api/portal/me/progress', (route) => json(route, progress))
}

const checklist = (page: Page) => page.getByTestId('onboarding-checklist')
const coachMark = (page: Page) => page.getByTestId('nav-coach-mark')

test.afterEach(async ({ page }) => {
  const unexpectedErrors = filterIgnorableErrors(getBrowserErrors(page))
  expect(unexpectedErrors).toEqual([])
})

test.describe('onboarding checklist', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupPageState(page)
    await initializeErrorTracking(page)
  })

  test('shows the done count, remaining prompts and CTA links', async ({ page }) => {
    await installGuestBackend(page, {
      rsvp_submitted: true,
      song_requested: false,
      photo_submitted: false,
      blessing_posted: true,
    })
    await page.goto('/dashboard')

    const card = checklist(page)
    await expect(card).toBeVisible()
    await expect(card.getByText("2 of 4 done — you haven't requested a song yet 🎵")).toBeVisible()

    // Completed items show as done rows.
    await expect(card.getByText('RSVP received — thank you!')).toBeVisible()
    await expect(card.getByText("Blessing posted — they'll treasure it.")).toBeVisible()

    // Remaining items carry CTA links to the right pages.
    await expect(card.getByRole('link', { name: 'Request a song' })).toHaveAttribute(
      'href',
      '/music',
    )
    await expect(card.getByRole('link', { name: 'Share a photo' })).toHaveAttribute(
      'href',
      '/gallery',
    )
    await expect(card.getByRole('link', { name: 'RSVP now' })).toHaveCount(0)
  })

  test('a dismissed row stays hidden across a reload', async ({ page }) => {
    await installGuestBackend(page, {
      rsvp_submitted: true,
      song_requested: false,
      photo_submitted: false,
      blessing_posted: true,
    })
    await page.goto('/dashboard')

    const card = checklist(page)
    await expect(card.getByText('Add a song to the wedding soundtrack.')).toBeVisible()

    await card.getByRole('button', { name: 'Hide the Song request reminder' }).click()
    await expect(card.getByText('Add a song to the wedding soundtrack.')).toHaveCount(0)
    // The other reminder is untouched.
    await expect(card.getByText('Share a favourite photo for the gallery.')).toBeVisible()

    await page.reload()
    await expect(checklist(page)).toBeVisible()
    await expect(checklist(page).getByText('Add a song to the wedding soundtrack.')).toHaveCount(0)
    await expect(
      checklist(page).getByText('Share a favourite photo for the gallery.'),
    ).toBeVisible()
  })

  test('the card does not render when everything is complete', async ({ page }) => {
    await installGuestBackend(page, {
      rsvp_submitted: true,
      song_requested: true,
      photo_submitted: true,
      blessing_posted: true,
    })
    await page.goto('/dashboard')

    // The dashboard itself is up (quick links rendered)...
    await expect(page.getByRole('region', { name: 'Quick links' })).toBeVisible()
    // ...but the checklist stays out of the way.
    await expect(checklist(page)).toHaveCount(0)
  })

  test('dismissing every remaining row hides the whole card', async ({ page }) => {
    await installGuestBackend(page, {
      rsvp_submitted: true,
      song_requested: false,
      photo_submitted: true,
      blessing_posted: true,
    })
    await page.goto('/dashboard')

    await checklist(page)
      .getByRole('button', { name: 'Hide the Song request reminder' })
      .click()
    await expect(checklist(page)).toHaveCount(0)
  })
})

test.describe('first-visit nav coach mark', () => {
  // No cleanupPageState here: that helper pre-seeds the "seen" flag so the
  // hint stays out of every other spec. These tests manage the flag.
  test.beforeEach(async ({ page }) => {
    await initializeErrorTracking(page)
    await page.route('**/api/portal/theme', (route) => json(route, { theme: null }))
    await installGuestBackend(page, {
      rsvp_submitted: true,
      song_requested: true,
      photo_submitted: true,
      blessing_posted: true,
    })
  })

  test('shows on the first visit and can be dismissed', async ({ page }) => {
    await page.goto('/dashboard')

    const hint = coachMark(page)
    await expect(hint).toBeVisible()
    await expect(
      hint.getByText('Everything lives up here — RSVP, the schedule, the dancefloor and more.'),
    ).toBeVisible()

    await hint.getByRole('button', { name: 'Got it' }).click()
    await expect(coachMark(page)).toHaveCount(0)

    // Never again on later visits.
    await page.reload()
    await expect(page.getByRole('region', { name: 'Quick links' })).toBeVisible()
    await expect(coachMark(page)).toHaveCount(0)
  })

  test('shows exactly once even when never dismissed', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(coachMark(page)).toBeVisible()

    await page.reload()
    await expect(page.getByRole('region', { name: 'Quick links' })).toBeVisible()
    await expect(coachMark(page)).toHaveCount(0)

    const seen = await page.evaluate((key) => window.localStorage.getItem(key), HINT_KEY)
    expect(seen).toBe('1')
  })
})

test.describe('how this works dialog', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupPageState(page)
    await initializeErrorTracking(page)
    await installGuestBackend(page, {
      rsvp_submitted: true,
      song_requested: true,
      photo_submitted: true,
      blessing_posted: true,
    })
  })

  test('opens from the footer and reads comfortably at any width', async ({ page }) => {
    await page.goto('/dashboard')

    const trigger = page.getByRole('button', { name: 'How this works' })
    await trigger.scrollIntoViewIfNeeded()
    await trigger.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'How this works' })).toBeVisible()

    // One sentence per page, all six pages present.
    for (const pageName of ['Dashboard', 'RSVP', 'Schedule', 'Blessings', 'Dancefloor', 'Gallery']) {
      await expect(dialog.getByText(pageName, { exact: true })).toBeVisible()
    }
    // The phase note about RSVP/songs opening when the couple flips live.
    await expect(dialog.getByText(/RSVP and song requests open when Ashley & Hazel/)).toBeVisible()

    // Readable at this project's viewport (the mobile project runs a Pixel 5):
    // the dialog never overflows the screen horizontally.
    const viewport = page.viewportSize()
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThanOrEqual(viewport!.width)
    expect(box!.x).toBeGreaterThanOrEqual(0)

    // And it closes.
    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

import { expect, test, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

/**
 * The Celebrate hub (Blessings/Dancefloor/Gallery consolidated onto one
 * screen -- see Celebrate.tsx): three launcher cards with live teasers, each
 * opening its existing page content in a modal. Deep interactions within
 * each modal (posting a blessing, requesting a song, browsing the gallery)
 * are covered by blessings.spec.ts, music.spec.ts, and guest-gallery.spec.ts
 * respectively -- this file covers hub-level behaviour only.
 */

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
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
  await page.route('**/api/mentions/directory*', async (route) => {
    await json(route, [])
  })
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors)
  expect(unexpectedErrors).toEqual([])
})

test('teasers default to zero when there is no data yet', async ({ page }) => {
  await page.goto('/celebrate')

  await expect(page.getByRole('button', { name: 'Open Blessings: 0 blessings' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open Dancefloor: 0 songs' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open Gallery: 0 photos' })).toBeVisible()
})

test('teasers reflect real counts, singular where appropriate', async ({ page }) => {
  await page.route('**/api/blessings', (route) =>
    json(route, [
      { id: 1, author_name: 'Aunt May', message: 'Hi', created_at: '2026-05-01T10:00:00Z' },
    ]),
  )
  await page.route('**/api/music/requests/wall', (route) =>
    json(route, {
      songs: [
        {
          id: 1,
          title: 'Song',
          artist: null,
          requested_by: 'X',
          pinned: false,
          reaction_count: 0,
          reacted_by_me: false,
          dedication: null,
        },
      ],
      now_playing: null,
    }),
  )
  await page.route('**/api/gallery/approved', (route) =>
    json(route, [
      {
        id: 1,
        title: 'Photo',
        caption: null,
        url: '/x.jpg',
        thumb_url: null,
        content_type: 'image/jpeg',
      },
    ]),
  )

  await page.goto('/celebrate')

  await expect(page.getByRole('button', { name: 'Open Blessings: 1 blessing' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open Dancefloor: 1 song' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open Gallery: 1 photo' })).toBeVisible()
})

test('dancefloor teaser shows the currently-playing pick when the couple set one', async ({
  page,
}) => {
  const song = {
    id: 1,
    title: 'September',
    artist: 'Earth, Wind & Fire',
    requested_by: 'X',
    pinned: false,
    reaction_count: 0,
    reacted_by_me: false,
    dedication: null,
  }
  await page.route('**/api/music/requests/wall', (route) =>
    json(route, { songs: [song], now_playing: song }),
  )

  await page.goto('/celebrate')

  await expect(
    page.getByRole('button', {
      name: 'Open Dancefloor: Now playing — September — Earth, Wind & Fire',
    }),
  ).toBeVisible()
})

test('opening a launcher shows its content in a modal; Escape returns to the hub', async ({
  page,
}) => {
  await page.goto('/celebrate')

  await page.getByRole('button', { name: 'Open Blessings' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  // Not asserting on the dialog's own title/description text -- the sr-only
  // DialogTitle/DialogDescription intentionally mirror BlessingsContent's
  // own visible header (see Celebrate.tsx), so those strings are duplicated.
  // "Sign the guestbook" only appears in BlessingsContent's own markup.
  await expect(dialog.getByText('Sign the guestbook')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Open Blessings' })).toBeVisible()
})

test('only one modal is open at a time', async ({ page }) => {
  await page.goto('/celebrate')

  await page.getByRole('button', { name: 'Open Blessings' }).click()
  await expect(page.getByRole('dialog').getByText('Sign the guestbook')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByRole('button', { name: 'Open Dancefloor' }).click()
  await expect(
    page.getByRole('dialog').getByText('Help build the wedding soundtrack', { exact: false }),
  ).toBeVisible()
})

test('the URL stays on /celebrate while a modal is open', async ({ page }) => {
  await page.goto('/celebrate')

  await page.getByRole('button', { name: 'Open Gallery' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page).toHaveURL(/\/celebrate$/)
})

test.describe('old standalone routes redirect to the hub', () => {
  for (const path of ['/blessings', '/music', '/gallery']) {
    test(`${path} redirects to /celebrate`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/celebrate$/)
      await expect(page.getByRole('button', { name: 'Open Blessings' })).toBeVisible()
    })
  }
})

import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

interface Blessing {
  id: number
  author_name: string
  message: string
  created_at: string
}

interface MentionEntry {
  invite_id: number
  display_name: string
}

const existing: Blessing[] = [
  {
    id: 1,
    author_name: 'Aunt May',
    message: 'Wishing you a lifetime of love.',
    created_at: '2026-05-01T10:00:00Z',
  },
]

// @mentions (Wave 3 item 16): the general-scope directory the Blessings
// composer/wall match against -- wedding-party members + labelled couple,
// never the full guest list (see docs/specs/MENTIONS.md).
const mentionDirectory: MentionEntry[] = [
  { invite_id: 201, display_name: 'Alex Best Man' },
  { invite_id: 202, display_name: 'Jordan Maid' },
]

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

async function installBlessingsApi(page: Page, seed: Blessing[]) {
  const blessings = seed.map((item) => ({ ...item }))
  let nextId = 1000

  await page.route('**/api/blessings', async (route) => {
    const method = route.request().method()

    if (method === 'GET') {
      await json(route, blessings)
      return
    }

    if (method === 'POST') {
      const payload = route.request().postDataJSON() as {
        author_name?: string | null
        message: string
      }
      nextId += 1
      const created: Blessing = {
        id: nextId,
        author_name: payload.author_name?.trim() || 'Guest',
        message: payload.message,
        created_at: '2026-06-24T12:00:00Z',
      }
      blessings.push(created)
      await json(route, created, 201)
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

  // The MentionTextarea (message composer) fetches this once per mount.
  await page.route('**/api/mentions/directory*', async (route) => {
    await json(route, mentionDirectory)
  })
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors)
  expect(unexpectedErrors).toEqual([])
})

function blessingsRegion(page: Page) {
  return page.getByRole('region', { name: 'Blessings' })
}

// Blessings now renders inside a modal launched from the Celebrate hub
// (Blessings/Dancefloor/Gallery consolidated -- see Celebrate.tsx);
// /blessings redirects to /celebrate.
async function openBlessings(page: Page) {
  await page.goto('/celebrate')
  await page.getByRole('button', { name: 'Open Blessings' }).click()
}

test('renders existing blessings', async ({ page }) => {
  await installBlessingsApi(page, existing)
  await openBlessings(page)

  await expect(blessingsRegion(page).getByText('Aunt May')).toBeVisible()
  await expect(blessingsRegion(page).getByText('Wishing you a lifetime of love.')).toBeVisible()
})

test('prefills the name from the current user', async ({ page }) => {
  await installBlessingsApi(page, existing)
  await openBlessings(page)

  await expect(page.getByLabel('Your name')).toHaveValue('Wedding Guest')
})

test('submitting a blessing adds it to the list and clears the message', async ({ page }) => {
  await installBlessingsApi(page, existing)
  await openBlessings(page)

  await page.getByLabel('Message').fill('Congratulations to you both!')
  await page.getByRole('button', { name: 'Post blessing' }).click()

  await expect(page.getByRole('status')).toHaveText('Thanks! Your blessing has been shared.')
  await expect(blessingsRegion(page).getByText('Congratulations to you both!')).toBeVisible()
  await expect(page.getByLabel('Message')).toHaveValue('')
})

test('shows the empty state when there are no blessings', async ({ page }) => {
  await installBlessingsApi(page, [])
  await openBlessings(page)

  await expect(page.getByText('No blessings yet')).toBeVisible()
})

// ---------------------------------------------------------------------------
// @mentions (Wave 3 item 16)
// ---------------------------------------------------------------------------

test('autocomplete shows filtered suggestions and inserts a mention on click', async ({
  page,
}) => {
  await installBlessingsApi(page, [])
  await openBlessings(page)

  const messageField = page.getByLabel('Message')
  await messageField.fill('Big shoutout to @Alex')

  await expect(page.getByRole('option', { name: 'Alex Best Man' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Jordan Maid' })).toHaveCount(0)

  await page.getByRole('option', { name: 'Alex Best Man' }).click()
  await expect(messageField).toHaveValue('Big shoutout to @Alex Best Man ')
})

test('renders a highlighted mention on the blessings wall', async ({ page }) => {
  await installBlessingsApi(page, [
    {
      id: 1,
      author_name: 'Aunt May',
      message: 'So happy for @Alex Best Man and the happy couple!',
      created_at: '2026-05-01T10:00:00Z',
    },
  ])
  await openBlessings(page)

  const highlighted = blessingsRegion(page).locator('span.text-gold')
  await expect(highlighted).toHaveText('@Alex Best Man')
})

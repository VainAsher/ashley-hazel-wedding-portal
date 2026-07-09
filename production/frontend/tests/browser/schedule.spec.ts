import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

interface ScheduleEvent {
  id: number
  event_name: string
  event_date: string
  event_time: string | null
  location: string | null
  description: string | null
}

const events: ScheduleEvent[] = [
  {
    id: 2,
    event_name: 'Reception',
    event_date: '2026-09-12',
    event_time: '18:00',
    location: 'The Grand Hall',
    description: 'Dinner and dancing.',
  },
  {
    id: 1,
    event_name: 'Ceremony',
    event_date: '2026-09-12',
    event_time: '15:30',
    location: 'Rosewood Chapel',
    description: 'The vows.',
  },
]

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

async function installScheduleApi(page: Page, body: ScheduleEvent[]) {
  await page.route('**/api/portal/schedule', async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, body)
      return
    }
    await json(route, { detail: 'Not found' }, 404)
  })
}

// The schedule page also loads the wedding record so it can synthesize a
// ceremony entry when the events list doesn't include one.
async function installWeddingApi(page: Page) {
  await page.route('**/api/portal/wedding', async (route) => {
    await json(route, {
      couple_names: 'Avery & Blake',
      wedding_date: '2026-09-12',
      ceremony_time: '15:30',
      ceremony_location: 'Rosewood Chapel',
      reception_location: 'The Grand Hall',
      phase: 'live',
    })
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
  const unexpectedErrors = filterIgnorableErrors(browserErrors)
  expect(unexpectedErrors).toEqual([])
})

function scheduleRegion(page: Page) {
  return page.getByRole('region', { name: 'Schedule events' })
}

test('renders schedule events ordered by time', async ({ page }) => {
  await installWeddingApi(page)
  await installScheduleApi(page, events.map((event) => ({ ...event })))
  await page.goto('/schedule')

  const headings = scheduleRegion(page).getByRole('heading')
  await expect(headings.first()).toHaveText('Ceremony')
  await expect(headings.nth(1)).toHaveText('Reception')
  // The couple already listed a ceremony, so no synthesized duplicate.
  await expect(headings).toHaveCount(2)

  await expect(scheduleRegion(page).getByText('Rosewood Chapel')).toBeVisible()
  await expect(scheduleRegion(page).getByText('The vows.')).toBeVisible()
})

test('synthesizes the ceremony from wedding details when events omit it', async ({ page }) => {
  await installWeddingApi(page)
  await installScheduleApi(page, [events[0]]) // Reception only
  await page.goto('/schedule')

  const headings = scheduleRegion(page).getByRole('heading')
  await expect(headings.first()).toHaveText('Wedding Ceremony')
  await expect(headings.nth(1)).toHaveText('Reception')
  await expect(scheduleRegion(page).getByText('Rosewood Chapel')).toBeVisible()
})

test('shows the empty state when there are no events', async ({ page }) => {
  await page.route('**/api/portal/wedding', (route) => route.abort())
  await installScheduleApi(page, [])
  await page.goto('/schedule')

  await expect(page.getByRole('main').getByText('No events yet')).toBeVisible()
})

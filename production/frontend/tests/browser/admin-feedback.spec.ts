import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

interface FeedbackItem {
  id: number
  wedding_id: number
  submitted_by: string
  type: 'bug' | 'idea'
  message: string
  page: string | null
  role: string | null
  viewport: string | null
  status: 'new' | 'triaged' | 'done'
  created_at: string
}

const initialFeedback: FeedbackItem[] = [
  {
    id: 5001,
    wedding_id: 1,
    submitted_by: 'Auntie Mabel',
    type: 'bug',
    message: 'The gallery photos overlap on my phone.',
    page: '/gallery',
    role: 'guest',
    viewport: '390x844',
    status: 'new',
    created_at: '2026-07-09T10:00:00Z',
  },
  {
    id: 5002,
    wedding_id: 1,
    submitted_by: 'Cousin Rob',
    type: 'idea',
    message: 'Add a map to the schedule page.',
    page: '/schedule',
    role: 'guest',
    viewport: '1280x720',
    status: 'triaged',
    created_at: '2026-07-08T09:00:00Z',
  },
]

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

async function installFeedbackApi(page: Page) {
  let items = initialFeedback.map((item) => ({ ...item }))

  await page.route('**/api/feedback', async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, items)
      return
    }
    await json(route, { detail: 'Not found' }, 404)
  })

  await page.route(/\/api\/feedback\/\d+$/, async (route) => {
    const request = route.request()
    const match = new URL(request.url()).pathname.match(/\/api\/feedback\/(\d+)$/)
    if (match && request.method() === 'PATCH') {
      const feedbackId = Number(match[1])
      const payload = request.postDataJSON() as { status: FeedbackItem['status'] }
      const existing = items.find((item) => item.id === feedbackId)
      if (!existing) {
        await json(route, { detail: 'Feedback not found' }, 404)
        return
      }
      const updated = { ...existing, status: payload.status }
      items = items.map((item) => (item.id === feedbackId ? updated : item))
      await json(route, updated)
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
      id: 1,
      name: 'Test Coordinator',
      role: 'coordinator',
      wedding_id: 1,
      invite_id: 1,
      guest_id: null,
      wedding_phase: 'live',
    })
  })

  await installFeedbackApi(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors)
  expect(unexpectedErrors).toEqual([])
})

function mainRegion(page: Page) {
  return page.getByRole('main')
}

test('shows the new queue by default with type badge and context line', async ({ page }) => {
  await page.goto('/admin/feedback')

  // Filter tabs with counts; "New" is the default view.
  await expect(mainRegion(page).getByRole('button', { name: 'New (1)' })).toBeVisible()
  await expect(mainRegion(page).getByRole('button', { name: 'Triaged (1)' })).toBeVisible()
  await expect(mainRegion(page).getByRole('button', { name: 'Done (0)' })).toBeVisible()

  await expect(
    mainRegion(page).getByText('The gallery photos overlap on my phone.'),
  ).toBeVisible()
  await expect(mainRegion(page).getByText('🐞 bug')).toBeVisible()
  await expect(mainRegion(page).getByText(/\/gallery · guest · 390x844 · /)).toBeVisible()

  // Triaged items are not in the New tab.
  await expect(
    mainRegion(page).getByText('Add a map to the schedule page.'),
  ).not.toBeVisible()
})

test('triaging a new item moves it to the Triaged tab', async ({ page }) => {
  await page.goto('/admin/feedback')

  await page
    .getByRole('button', { name: 'Triage bug from Auntie Mabel' })
    .click()

  await expect(page.getByRole('status')).toHaveText(
    'Feedback from Auntie Mabel marked as triaged.',
  )

  // Gone from New…
  await expect(mainRegion(page).getByRole('button', { name: 'New (0)' })).toBeVisible()
  await expect(
    mainRegion(page).getByText('The gallery photos overlap on my phone.'),
  ).not.toBeVisible()

  // …and present under Triaged.
  await mainRegion(page).getByRole('button', { name: 'Triaged (2)' }).click()
  await expect(
    mainRegion(page).getByText('The gallery photos overlap on my phone.'),
  ).toBeVisible()
})

test('marking a triaged item done moves it to the Done tab', async ({ page }) => {
  await page.goto('/admin/feedback')

  await mainRegion(page).getByRole('button', { name: 'Triaged (1)' }).click()
  await page.getByRole('button', { name: 'Mark idea from Cousin Rob done' }).click()

  await expect(page.getByRole('status')).toHaveText(
    'Feedback from Cousin Rob marked as done.',
  )

  await mainRegion(page).getByRole('button', { name: 'Done (1)' }).click()
  await expect(
    mainRegion(page).getByText('Add a map to the schedule page.'),
  ).toBeVisible()
})

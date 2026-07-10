import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

interface FeedbackPayload {
  type: string
  message: string
  page: string | null
  role: string | null
  viewport: string | null
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

async function installPortalApi(page: Page) {
  await page.route('**/api/portal/wedding', async (route) => {
    await json(route, {
      couple_names: 'Ashley & Hazel',
      wedding_date: '2027-06-19',
      ceremony_time: '15:30',
      ceremony_location: 'Halifax',
      reception_location: 'The Grand Hall',
      phase: 'live',
    })
  })
}

/** Mock POST /api/feedback and capture the submitted payloads. */
async function installFeedbackApi(page: Page): Promise<FeedbackPayload[]> {
  const payloads: FeedbackPayload[] = []

  await page.route('**/api/feedback', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as FeedbackPayload
      payloads.push(payload)
      await json(
        route,
        {
          id: 4001,
          wedding_id: 1,
          submitted_by: 'Wedding Guest',
          status: 'new',
          created_at: '2026-07-10T12:00:00Z',
          ...payload,
        },
        201,
      )
      return
    }
    await json(route, { detail: 'Not found' }, 404)
  })

  return payloads
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

  await installPortalApi(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors)
  expect(unexpectedErrors).toEqual([])
})

test('guest submits feedback with auto-captured context', async ({ page }) => {
  const payloads = await installFeedbackApi(page)

  await page.goto('/dashboard')

  // The floating pill is a button (the admin nav "Feedback" entry is a link).
  await page.getByRole('button', { name: 'Feedback' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Spotted something?')).toBeVisible()

  // Auto-captured context is shown subtly: page path, role, viewport WxH.
  const viewport = page.viewportSize()
  const viewportLabel = `${viewport?.width}x${viewport?.height}`
  await expect(
    dialog.getByText(`Sent with: /dashboard · guest · ${viewportLabel}`),
  ).toBeVisible()

  await dialog.getByRole('button', { name: 'Idea' }).click()
  await dialog
    .getByLabel('What happened, or what would make this better?')
    .fill('A map link on the schedule would be lovely.')
  await dialog.getByRole('button', { name: 'Send' }).click()

  await expect(dialog.getByRole('status')).toContainText('Thank you!')

  expect(payloads).toEqual([
    {
      type: 'idea',
      message: 'A map link on the schedule would be lovely.',
      page: '/dashboard',
      role: 'guest',
      viewport: viewportLabel,
    },
  ])
})

test('feedback widget makes no feedback requests until submitted', async ({ page }) => {
  const payloads = await installFeedbackApi(page)

  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Feedback' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // Opening the dialog alone must not call the API.
  expect(payloads).toEqual([])
})

test('send requires a message', async ({ page }) => {
  const payloads = await installFeedbackApi(page)

  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Feedback' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Send' }).click()

  await expect(dialog.getByRole('alert')).toContainText('Please write a quick note')
  expect(payloads).toEqual([])
})

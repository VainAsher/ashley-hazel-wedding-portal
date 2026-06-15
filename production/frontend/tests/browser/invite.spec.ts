import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

interface LoginRequestRecord {
  invite_code?: string
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

async function trackBrowserErrors(page: Page) {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  Reflect.set(page, 'browserErrors', browserErrors)
}

test.beforeEach(async ({ page }) => {
  // Clean up any previous test state
  await cleanupPageState(page)
  await initializeErrorTracking(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [
    'the server responded with a status of 401',
    'net::ERR_FAILED',
  ])
  expect(unexpectedErrors).toEqual([])
})

test('redirects unauthenticated root traffic to invite form', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => {
    await json(route, { detail: 'Not authenticated' }, 401)
  })

  await page.goto('/')

  await expect(page).toHaveURL(/\/invite$/)
  await expect(page.getByRole('heading', { name: 'Enter Invite Code' })).toBeVisible()
  await expect(page.getByLabel('Invite Code')).toBeVisible()
})

test('requires an invite code before submitting', async ({ page }) => {
  await page.goto('/invite')

  await page.getByRole('button', { name: 'Enter' }).click()

  await expect(page.getByRole('alert')).toHaveText('Invite code is required.')
})

test('shows code not found for invalid invite response', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    await json(route, { detail: 'Invalid invite code' }, 401)
  })

  await page.goto('/invite')
  await page.getByLabel('Invite Code').fill('bad-code')
  await page.getByRole('button', { name: 'Enter' }).click()

  await expect(page.getByRole('alert')).toHaveText('Code not found')
  await expect(page).toHaveURL(/\/invite$/)
})

test('shows network error when login request cannot complete', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    await route.abort()
  })

  await page.goto('/invite')
  await page.getByLabel('Invite Code').fill('DEMO-001')
  await page.getByRole('button', { name: 'Enter' }).click()

  await expect(page.getByRole('alert')).toHaveText('Unable to reach the server. Try again.')
  await expect(page).toHaveURL(/\/invite$/)
})

test('submits trimmed invite code and redirects to rsvp on success', async ({ page }) => {
  const requests: LoginRequestRecord[] = []
  const user = {
    id: 10,
    name: 'Demo Guest',
    role: 'guest',
    wedding_id: 1,
    invite_id: 20,
    guest_id: 10,
  }

  await page.route('**/api/auth/login', async (route) => {
    requests.push(route.request().postDataJSON() as LoginRequestRecord)
    await json(route, { user })
  })
  await page.route('**/api/auth/me', async (route) => {
    await json(route, user)
  })
  await page.route('**/api/guests/10', async (route) => {
    await json(route, {
      id: 10,
      wedding_id: 1,
      name: 'Demo Guest',
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
      table_number: null,
      seat_number: null,
      notes: null,
      created_at: null,
      updated_at: null,
    })
  })

  await page.goto('/invite')
  await page.getByLabel('Invite Code').fill('  demo-001  ')
  await page.getByRole('button', { name: 'Enter' }).click()

  await expect(page).toHaveURL(/\/rsvp$/)
  await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible()
  expect(requests).toEqual([{ invite_code: 'demo-001' }])
})

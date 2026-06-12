import { expect, test, type Page, type Route } from '@playwright/test'

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
  await trackBrowserErrors(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = Reflect.get(page, 'browserErrors') as string[] | undefined
  const unexpectedErrors = (browserErrors ?? []).filter(
    (message) =>
      !message.includes('the server responded with a status of 401') &&
      !message.includes('net::ERR_FAILED'),
  )
  expect(unexpectedErrors).toEqual([])
})

test('redirects unauthenticated root traffic to invite form', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/invite$/)
  await expect(page.getByRole('heading', { name: 'Enter Invite Code' })).toBeVisible()
  await expect(page.getByLabel('Invite Code')).toBeVisible()
})

test('requires an invite code before submitting', async ({ page }) => {
  await page.goto('/invite')

  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('alert')).toHaveText('Invite code is required.')
})

test('shows code not found for invalid invite response', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    await json(route, { detail: 'Invalid invite code' }, 401)
  })

  await page.goto('/invite')
  await page.getByLabel('Invite Code').fill('bad-code')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('alert')).toHaveText('Code not found')
  await expect(page).toHaveURL(/\/invite$/)
})

test('shows network error when login request cannot complete', async ({ page }) => {
  await page.route('**/api/auth/login', async (route) => {
    await route.abort()
  })

  await page.goto('/invite')
  await page.getByLabel('Invite Code').fill('DEMO-001')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('alert')).toHaveText('Unable to reach the server. Try again.')
  await expect(page).toHaveURL(/\/invite$/)
})

test('submits trimmed invite code and redirects to rsvp on success', async ({ page }) => {
  const requests: LoginRequestRecord[] = []
  await page.route('**/api/auth/login', async (route) => {
    requests.push(route.request().postDataJSON() as LoginRequestRecord)
    await json(route, {
      user: {
        id: 10,
        name: 'Demo Guest',
        role: 'guest',
        wedding_id: 1,
        invite_id: 20,
        guest_id: 10,
      },
    })
  })

  await page.goto('/invite')
  await page.getByLabel('Invite Code').fill('  demo-001  ')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page).toHaveURL(/\/rsvp$/)
  await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible()
  expect(requests).toEqual([{ invite_code: 'demo-001' }])
})

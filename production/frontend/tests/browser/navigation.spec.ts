import { expect, test } from '@playwright/test'

const guests = [
  {
    id: 1001,
    wedding_id: 1,
    name: 'Browser Validation Guest',
    email: 'browser.validation@example.com',
    phone: '555-0001',
    relationship: 'friend',
    rsvp_status: 'accepted',
    dietary_restrictions: null,
    plus_one_name: null,
    plus_one_rsvp: null,
    plus_one_dietary: null,
    table_number: 4,
    seat_number: 2,
    notes: 'Mocked browser validation',
    created_at: null,
    updated_at: null,
  },
]

test.beforeEach(async ({ page }) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  Reflect.set(page, 'browserErrors', browserErrors)

  await page.route('**/api/guests', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify(guests),
    })
  })
})

test.afterEach(async ({ page }) => {
  const browserErrors = Reflect.get(page, 'browserErrors') as string[] | undefined
  const unexpectedErrors = (browserErrors ?? []).filter(
    (message) => !message.includes('the server responded with a status of 401'),
  )
  expect(unexpectedErrors).toEqual([])
})

test('routes from invite entry to guests and renders guest data', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 401,
      body: JSON.stringify({ detail: 'Not authenticated' }),
    })
  })

  await page.goto('/')
  await expect(page).toHaveURL(/\/invite$/)
  await expect(page.getByRole('heading', { name: 'Enter Invite Code' })).toBeVisible()

  await page.getByRole('link', { name: 'Guests', exact: true }).click()
  await expect(page).toHaveURL(/\/guests$/)
  await expect(page.getByRole('heading', { name: 'Guest Management' })).toBeVisible()
  await expect(page.getByText('Browser Validation Guest')).toBeVisible()
  await expect(page.getByText('browser.validation@example.com')).toBeVisible()
})

test('direct guests route and fallback route are browser-accessible', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        id: 1,
        name: 'Test Couple',
        role: 'couple',
        wedding_id: 1,
        invite_id: 1,
        guest_id: null,
      }),
    })
  })

  await page.goto('/guests')
  await expect(page.getByRole('heading', { name: 'Guest Management' })).toBeVisible()

  await page.goto('/not-a-real-route')
  await expect(page).toHaveURL(/\/invite$/)
  await expect(page.getByRole('heading', { name: 'Enter Invite Code' })).toBeVisible()
})

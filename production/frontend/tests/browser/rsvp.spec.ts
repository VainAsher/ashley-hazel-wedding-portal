import { expect, test, type Page, type Route } from '@playwright/test'

type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'tentative'

interface Guest {
  id: number
  wedding_id: number
  name: string
  email: string | null
  phone: string | null
  relationship: string | null
  rsvp_status: RsvpStatus
  meal_choice: string | null
  dietary_notes: string | null
  dietary_restrictions: string | null
  plus_one_name: string | null
  plus_one_rsvp: RsvpStatus | null
  plus_one_dietary: string | null
  table_number: number | null
  seat_number: number | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

interface PatchRequestRecord {
  rsvp_status?: RsvpStatus
  meal_choice?: string | null
  dietary_notes?: string | null
  plus_one_name?: string | null
}

const currentUser = {
  id: 10,
  name: 'Demo Guest',
  role: 'guest',
  wedding_id: 1,
  invite_id: 20,
  guest_id: 10,
}

const initialGuest: Guest = {
  id: 10,
  wedding_id: 1,
  name: 'Demo Guest',
  email: 'demo@example.com',
  phone: null,
  relationship: 'friend',
  rsvp_status: 'accepted',
  meal_choice: 'vegetarian',
  dietary_notes: 'No nuts',
  dietary_restrictions: null,
  plus_one_name: 'Demo Plus One',
  plus_one_rsvp: null,
  plus_one_dietary: null,
  table_number: null,
  seat_number: null,
  notes: null,
  created_at: null,
  updated_at: null,
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

async function installRsvpApi(
  page: Page,
  options: {
    guest?: Guest
    patchStatus?: number
    patchDetail?: string
    requests?: PatchRequestRecord[]
  } = {},
) {
  let guest = { ...(options.guest ?? initialGuest) }

  await page.route('**/api/auth/me', async (route) => {
    await json(route, currentUser)
  })

  await page.route(/\/api\/guests\/10$/, async (route) => {
    const method = route.request().method()

    if (method === 'GET') {
      await json(route, guest)
      return
    }

    if (method === 'PATCH') {
      const payload = route.request().postDataJSON() as PatchRequestRecord
      options.requests?.push(payload)

      if (options.patchStatus && options.patchStatus >= 400) {
        await json(route, { detail: options.patchDetail ?? 'Unable to save RSVP' }, options.patchStatus)
        return
      }

      guest = { ...guest, ...payload }
      await json(route, guest)
      return
    }

    await json(route, { detail: 'Not found' }, 404)
  })
}

test.beforeEach(async ({ page }) => {
  await trackBrowserErrors(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = Reflect.get(page, 'browserErrors') as string[] | undefined
  const unexpectedErrors = (browserErrors ?? []).filter(
    (message) => !message.includes('the server responded with a status of 400'),
  )
  expect(unexpectedErrors).toEqual([])
})

test('renders current guest RSVP state', async ({ page }) => {
  await installRsvpApi(page)

  await page.goto('/rsvp')

  await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible()
  await expect(page.getByText('Demo Guest')).toBeVisible()
  await expect(page.getByLabel('Accept')).toBeChecked()
  await expect(page.getByLabel('Meal Choice')).toHaveValue('vegetarian')
  await expect(page.getByLabel('Dietary Notes')).toHaveValue('No nuts')
  await expect(page.getByLabel('Plus One Name')).toHaveValue('Demo Plus One')
})

test('submits RSVP changes and locks the saved form', async ({ page }) => {
  const requests: PatchRequestRecord[] = []
  await installRsvpApi(page, {
    guest: {
      ...initialGuest,
      rsvp_status: 'pending',
      meal_choice: null,
      dietary_notes: null,
      plus_one_name: null,
    },
    requests,
  })

  await page.goto('/rsvp')
  await page.getByLabel('Tentative').check()
  await page.getByLabel('Meal Choice').selectOption('fish')
  await page.getByLabel('Dietary Notes').fill('Dairy-free')
  await page.getByLabel('Plus One Name').fill('Taylor Guest')
  await page.getByRole('button', { name: 'Save RSVP' }).click()

  await expect(page.getByRole('status')).toHaveText('RSVP saved.')
  await expect(page.getByRole('button', { name: 'Saved' })).toBeDisabled()
  await expect(page.getByLabel('Tentative')).toBeDisabled()
  expect(requests).toEqual([
    {
      rsvp_status: 'tentative',
      meal_choice: 'fish',
      dietary_notes: 'Dairy-free',
      plus_one_name: 'Taylor Guest',
    },
  ])
})

test('shows API errors without leaving the form', async ({ page }) => {
  await installRsvpApi(page, {
    patchDetail: 'Unable to save RSVP',
    patchStatus: 400,
  })

  await page.goto('/rsvp')
  await page.getByLabel('Decline').check()
  await page.getByRole('button', { name: 'Save RSVP' }).click()

  await expect(page.getByRole('alert')).toHaveText('Unable to save RSVP')
  await expect(page.getByRole('button', { name: 'Save RSVP' })).toBeEnabled()
  await expect(page.getByLabel('Decline')).toBeEnabled()
})

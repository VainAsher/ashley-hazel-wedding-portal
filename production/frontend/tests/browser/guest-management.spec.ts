import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'tentative'

interface Guest {
  id: number
  wedding_id: number
  name: string
  email: string | null
  phone: string | null
  relationship: string | null
  rsvp_status: RsvpStatus
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

const initialGuest: Guest = {
  id: 2001,
  wedding_id: 1,
  name: 'Existing Guest',
  email: 'existing@example.com',
  phone: '555-0100',
  relationship: 'friend',
  rsvp_status: 'accepted',
  dietary_restrictions: null,
  plus_one_name: null,
  plus_one_rsvp: null,
  plus_one_dietary: null,
  table_number: 1,
  seat_number: 2,
  notes: 'Already invited',
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

async function installGuestApi(page: Page) {
  // Reset to initial state for each test - create a fresh copy
  let nextId = 3000
  let guests = [{ ...initialGuest }]

  await page.route(/\/api\/guests(?:\/\d+)?$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const detailMatch = url.pathname.match(/\/api\/guests\/(\d+)$/)

    if (url.pathname.endsWith('/api/guests') && method === 'GET') {
      await json(route, guests)
      return
    }

    if (url.pathname.endsWith('/api/guests') && method === 'POST') {
      const payload = request.postDataJSON() as Partial<Guest>
      if (payload.email === 'duplicate@example.com') {
        await json(route, { detail: 'Duplicate email' }, 400)
        return
      }

      const guest: Guest = {
        ...initialGuest,
        ...payload,
        id: nextId,
        created_at: null,
        updated_at: null,
      } as Guest
      nextId += 1
      guests = [...guests, guest]
      await json(route, guest, 201)
      return
    }

    if (detailMatch && method === 'PUT') {
      const guestId = Number(detailMatch[1])
      const payload = request.postDataJSON() as Partial<Guest>
      const existing = guests.find((guest) => guest.id === guestId)
      if (!existing) {
        await json(route, { detail: 'Guest not found' }, 404)
        return
      }

      const updated = { ...existing, ...payload, id: guestId }
      guests = guests.map((guest) => (guest.id === guestId ? updated : guest))
      await json(route, updated)
      return
    }

    if (detailMatch && method === 'DELETE') {
      const guestId = Number(detailMatch[1])
      guests = guests.filter((guest) => guest.id !== guestId)
      await json(route, { status: 'deleted', id: guestId })
      return
    }

    await json(route, { detail: 'Not found' }, 404)
  })
}

test.beforeEach(async ({ page }) => {
  // Clean up any previous test state
  await cleanupPageState(page)
  await initializeErrorTracking(page)

  // Mock authentication to return a couple role user
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

  await installGuestApi(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, ['the server responded with a status of 400'])
  expect(unexpectedErrors).toEqual([])
})

async function openAddGuestForm(page: Page) {
  await page.goto('/guests')
  await page.getByRole('button', { name: 'Add Guest' }).click()
  await expect(page.getByRole('heading', { name: 'Add Guest' })).toBeVisible()
}

async function fillRequiredGuestFields(page: Page, name: string, email: string) {
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Email').fill(email)
}

test('renders existing guest count and table columns', async ({ page }) => {
  await page.goto('/guests')

  await expect(page.getByText('1 guests')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Existing Guest', exact: true })).toBeVisible()
  for (const column of ['Actions', 'Name', 'Email', 'Phone', 'Relationship', 'RSVP']) {
    await expect(page.locator('th').filter({ hasText: new RegExp(`^${column}$`) })).toBeVisible()
  }
})

test('opens and cancels the add guest form', async ({ page }) => {
  await openAddGuestForm(page)

  await page.getByRole('button', { name: 'Cancel' }).first().click()

  await expect(page.getByRole('heading', { name: 'Add Guest' })).not.toBeVisible()
  await expect(page.getByRole('cell', { name: 'Existing Guest', exact: true })).toBeVisible()
})

test('validates required guest name before submit', async ({ page }) => {
  await openAddGuestForm(page)

  await page.getByRole('button', { name: 'Add Guest' }).click()

  await expect(page.getByRole('alert')).toHaveText('Guest name is required.')
})

test('validates email format before submit', async ({ page }) => {
  await openAddGuestForm(page)
  await fillRequiredGuestFields(page, 'Invalid Email Guest', 'not-an-email')

  await page.getByRole('button', { name: 'Add Guest' }).click()

  await expect(page.getByRole('alert')).toHaveText('Email must contain @.')
})

test('validates wedding id before submit', async ({ page }) => {
  await openAddGuestForm(page)
  await page.getByLabel('Wedding ID').fill('0')
  await fillRequiredGuestFields(page, 'Invalid Wedding Guest', 'invalid-wedding@example.com')

  await page.getByRole('button', { name: 'Add Guest' }).click()

  await expect(page.getByRole('alert')).toHaveText('Wedding ID is required.')
})

test('adds a guest with plus-one and dietary details', async ({ page }) => {
  await openAddGuestForm(page)
  await fillRequiredGuestFields(page, 'Detailed E2E Guest', 'detailed.e2e@example.com')
  await page.getByLabel('Dietary Restrictions').fill('Vegetarian')
  await page.getByLabel('Plus One', { exact: true }).fill('Detailed Plus One')
  await page.getByLabel('Plus One RSVP').selectOption('accepted')
  await page.getByLabel('Plus One Dietary').fill('Nut allergy')
  await page.getByLabel('Table').fill('8')
  await page.getByLabel('Seat').fill('4')
  await page.getByLabel('Notes').fill('Needs aisle seat')

  await page.getByRole('button', { name: 'Add Guest' }).click()

  await expect(page.getByRole('status')).toHaveText('Guest added successfully.')
  await expect(page.getByRole('cell', { name: 'Detailed E2E Guest', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Vegetarian' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Detailed Plus One' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Nut allergy' })).toBeVisible()
})

test('cancels edit without changing selected guest details', async ({ page }) => {
  await page.goto('/guests')
  await page.getByRole('button', { name: 'View Existing Guest' }).click()
  await page.getByRole('button', { name: 'Edit Guest' }).click()
  await page.getByLabel('Relationship').fill('changed relationship')

  await page.getByRole('button', { name: 'Cancel' }).last().click()

  const details = page.locator('section[aria-labelledby="guest-details-title"]')
  await expect(details.getByText('friend')).toBeVisible()
  await expect(details.getByText('changed relationship')).not.toBeVisible()
})

test('dismisses delete confirmation and keeps guest visible', async ({ page }) => {
  await page.goto('/guests')
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Delete Existing Guest')
    await dialog.dismiss()
  })

  await page.getByRole('button', { name: 'Delete Existing Guest' }).click()

  await expect(page.getByRole('cell', { name: 'Existing Guest', exact: true })).toBeVisible()
  await expect(page.getByRole('status')).not.toBeVisible()
})

test('shows empty state after deleting the only guest', async ({ page }) => {
  await page.goto('/guests')
  page.once('dialog', async (dialog) => {
    await dialog.accept()
  })

  await page.getByRole('button', { name: 'Delete Existing Guest' }).click()

  await expect(page.getByRole('status')).toHaveText('Guest deleted successfully.')
  await expect(page.getByText('No guests found.')).toBeVisible()
  await expect(page.getByText('0 guests')).toBeVisible()
})

test('completes add guest flow on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openAddGuestForm(page)
  await fillRequiredGuestFields(page, 'Mobile E2E Guest', 'mobile.e2e@example.com')

  await page.getByRole('button', { name: 'Add Guest' }).click()

  await expect(page.getByRole('status')).toHaveText('Guest added successfully.')
  await expect(page.getByRole('cell', { name: 'Mobile E2E Guest', exact: true })).toBeVisible()
})

test('completes add, view, edit, and delete guest flow', async ({ page }) => {
  await page.goto('/guests')
  await expect(page.getByRole('heading', { name: 'Guest Management' })).toBeVisible()
  await expect(page.getByText('Existing Guest')).toBeVisible()

  await page.getByRole('button', { name: 'Add Guest' }).click()
  await page.getByLabel('Name').fill('E2E Taylor')
  await page.getByLabel('Email').fill('e2e.taylor@example.com')
  await page.getByLabel('Phone').fill('555-0199')
  await page.getByLabel('Relationship').fill('colleague')
  await page.getByLabel('RSVP', { exact: true }).selectOption('accepted')
  await page.getByLabel('Table').fill('5')
  await page.getByLabel('Seat').fill('3')
  await page.getByLabel('Notes').fill('Browser-created guest')
  await page.getByRole('button', { name: 'Add Guest' }).click()

  await expect(page.getByRole('status')).toHaveText('Guest added successfully.')
  await expect(page.getByRole('cell', { name: 'E2E Taylor', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'View E2E Taylor' }).click()
  const details = page.locator('section[aria-labelledby="guest-details-title"]')
  await expect(page.getByRole('heading', { name: 'Guest Details' })).toBeVisible()
  await expect(details.getByText('e2e.taylor@example.com')).toBeVisible()

  await page.getByRole('button', { name: 'Edit E2E Taylor' }).click()
  await expect(page.getByRole('heading', { name: 'Edit Guest' })).toBeVisible()
  await page.getByLabel('Relationship').fill('family')
  await page.getByLabel('RSVP', { exact: true }).selectOption('tentative')
  await page.getByRole('button', { name: 'Save Guest' }).click()

  await expect(page.getByRole('status')).toHaveText('Guest updated successfully.')
  await expect(page.getByRole('heading', { name: 'Guest Details' })).toBeVisible()
  await expect(details.getByText('family')).toBeVisible()
  await expect(details.getByText('tentative')).toBeVisible()

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Delete E2E Taylor')
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Delete E2E Taylor' }).click()

  await expect(page.getByRole('status')).toHaveText('Guest deleted successfully.')
  await expect(page.getByRole('cell', { name: 'E2E Taylor', exact: true })).not.toBeVisible()
})

test('shows validation and API errors, then clears them after success', async ({ page }) => {
  await page.goto('/guests')
  await page.getByRole('button', { name: 'Add Guest' }).click()

  await page.getByLabel('Name').fill('Error Case Guest')
  await page.getByLabel('Table').fill('0')
  await page.getByRole('button', { name: 'Add Guest' }).click()
  await expect(page.getByRole('alert')).toHaveText('Table number must be 1 or greater.')

  await page.getByLabel('Table').fill('1')
  await page.getByLabel('Email').fill('duplicate@example.com')
  await page.getByRole('button', { name: 'Add Guest' }).click()
  await expect(page.getByRole('alert')).toHaveText('Duplicate email')

  await page.getByLabel('Email').fill('error-case@example.com')
  await page.getByRole('button', { name: 'Add Guest' }).click()
  await expect(page.getByRole('status')).toHaveText('Guest added successfully.')
  await expect(page.getByRole('alert')).not.toBeVisible()
})

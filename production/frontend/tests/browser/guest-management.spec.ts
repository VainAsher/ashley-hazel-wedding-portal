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
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  Reflect.set(page, 'browserErrors', browserErrors)

  await installGuestApi(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = Reflect.get(page, 'browserErrors') as string[] | undefined
  const unexpectedErrors = (browserErrors ?? []).filter(
    (message) => !message.includes('the server responded with a status of 400'),
  )
  expect(unexpectedErrors).toEqual([])
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

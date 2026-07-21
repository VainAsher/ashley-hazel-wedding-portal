import { readFileSync } from 'node:fs'

import { expect, test, type Download, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'tentative'
type MealChoice = 'chicken' | 'fish' | 'vegetarian'

interface Guest {
  id: number
  wedding_id: number
  name: string
  email: string | null
  phone: string | null
  address: string | null
  relationship: string | null
  rsvp_status: RsvpStatus
  meal_choice: MealChoice | null
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
  address: '10 Guest Lane Halifax',
  relationship: 'friend',
  rsvp_status: 'accepted',
  meal_choice: 'chicken',
  dietary_restrictions: 'Gluten free',
  plus_one_name: null,
  plus_one_rsvp: null,
  plus_one_dietary: null,
  table_number: 1,
  seat_number: 2,
  notes: 'Already invited',
  created_at: null,
  updated_at: null,
}

const secondGuest: Guest = {
  id: 2002,
  wedding_id: 1,
  name: 'Alex Pending',
  email: 'alex@example.com',
  phone: '555-0199',
  address: null,
  relationship: 'colleague',
  rsvp_status: 'pending',
  meal_choice: null,
  dietary_restrictions: null,
  plus_one_name: 'Jordan Plus',
  plus_one_rsvp: 'accepted',
  plus_one_dietary: 'Shellfish allergy',
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

async function installGuestApi(page: Page, initialGuests: Guest[] = [{ ...initialGuest }]) {
  // Reset to initial state for each test - create a fresh copy
  let nextId = 3000
  let guests = initialGuests.map((guest) => ({ ...guest }))

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

function mainRegion(page: Page) {
  return page.getByRole('main')
}

function formDialog(page: Page) {
  return page.getByRole('dialog')
}

async function openAddGuestForm(page: Page) {
  await page.goto('/guests')
  await mainRegion(page).getByRole('button', { name: 'Add Guest' }).click()
  await expect(formDialog(page)).toBeVisible()
  await expect(formDialog(page).getByRole('heading', { name: 'Add Guest' })).toBeVisible()
}

async function selectOption(page: Page, triggerLabel: string, optionName: string) {
  await formDialog(page).getByLabel(triggerLabel).click()
  await page.getByRole('option', { name: optionName }).click()
}

async function submitGuestForm(page: Page, buttonName: 'Add Guest' | 'Save Guest') {
  await formDialog(page).getByRole('button', { name: buttonName }).click()
}

test('renders existing guest count and table columns', async ({ page }) => {
  await page.goto('/guests')

  await expect(mainRegion(page).getByText('1 guests')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Existing Guest', exact: true })).toBeVisible()
  for (const column of ['Name', 'RSVP Status', 'Meal', 'Dietary', 'Actions']) {
    await expect(page.locator('th').filter({ hasText: new RegExp(`^${column}$`) })).toBeVisible()
  }
})

test('opens and cancels the add guest form', async ({ page }) => {
  await openAddGuestForm(page)

  await formDialog(page).getByRole('button', { name: 'Cancel' }).click()

  await expect(formDialog(page)).not.toBeVisible()
  await expect(page.getByRole('cell', { name: 'Existing Guest', exact: true })).toBeVisible()
})

test('validates required guest name before submit', async ({ page }) => {
  await openAddGuestForm(page)

  await submitGuestForm(page, 'Add Guest')

  await expect(formDialog(page).getByRole('alert')).toHaveText('Guest name is required.')
})

test('validates email format before submit', async ({ page }) => {
  await openAddGuestForm(page)
  await formDialog(page).getByLabel('Name', { exact: true }).fill('Invalid Email Guest')
  await formDialog(page).getByLabel('Email').fill('not-an-email')

  await submitGuestForm(page, 'Add Guest')

  await expect(formDialog(page).getByRole('alert')).toHaveText('Email must contain @.')
})

test('validates wedding id before submit', async ({ page }) => {
  await openAddGuestForm(page)
  await formDialog(page).getByLabel('Wedding ID').fill('0')
  await formDialog(page).getByLabel('Name', { exact: true }).fill('Invalid Wedding Guest')

  await submitGuestForm(page, 'Add Guest')

  await expect(formDialog(page).getByRole('alert')).toHaveText('Wedding ID is required.')
})

test('adds a guest with meal and dietary details', async ({ page }) => {
  await openAddGuestForm(page)
  await formDialog(page).getByLabel('Name', { exact: true }).fill('Detailed E2E Guest')
  await formDialog(page).getByLabel('Email').fill('detailed.e2e@example.com')
  await selectOption(page, 'RSVP Status', 'Accepted')
  await selectOption(page, 'Meal', 'Vegetarian')
  await formDialog(page).getByLabel('Dietary', { exact: true }).fill('Nut allergy')
  await formDialog(page).getByLabel('Table').fill('8')
  await formDialog(page).getByLabel('Seat').fill('4')

  await submitGuestForm(page, 'Add Guest')

  await expect(page.getByRole('status')).toHaveText('Guest added successfully.')
  await expect(page.getByRole('cell', { name: 'Detailed E2E Guest', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'vegetarian', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Nut allergy', exact: true })).toBeVisible()
})

test('cancels edit without saving changes', async ({ page }) => {
  await page.goto('/guests')
  await page.getByRole('button', { name: 'Edit Existing Guest' }).click()
  await expect(formDialog(page).getByRole('heading', { name: 'Edit Guest' })).toBeVisible()

  await formDialog(page).getByLabel('Dietary', { exact: true }).fill('changed dietary')
  await formDialog(page).getByRole('button', { name: 'Cancel' }).click()

  await expect(formDialog(page)).not.toBeVisible()
  await expect(page.getByRole('cell', { name: 'Gluten free', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'changed dietary', exact: true })).not.toBeVisible()
})

test('dismisses delete confirmation and keeps guest visible', async ({ page }) => {
  await page.goto('/guests')

  await page.getByRole('button', { name: 'Delete Existing Guest' }).click()
  const dialog = formDialog(page)
  await expect(dialog.getByText('Delete Existing Guest?')).toBeVisible()

  await dialog.getByRole('button', { name: 'Cancel' }).click()

  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('cell', { name: 'Existing Guest', exact: true })).toBeVisible()
  await expect(page.getByRole('status')).not.toBeVisible()
})

test('shows empty state after deleting the only guest', async ({ page }) => {
  await page.goto('/guests')

  await page.getByRole('button', { name: 'Delete Existing Guest' }).click()
  await formDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText('Guest deleted successfully.')
  await expect(mainRegion(page).getByText('No guests found.')).toBeVisible()
  await expect(mainRegion(page).getByText('0 guests')).toBeVisible()
})

test('completes add guest flow on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openAddGuestForm(page)
  await formDialog(page).getByLabel('Name', { exact: true }).fill('Mobile E2E Guest')
  await formDialog(page).getByLabel('Email').fill('mobile.e2e@example.com')

  await submitGuestForm(page, 'Add Guest')

  await expect(page.getByRole('status')).toHaveText('Guest added successfully.')
  await expect(page.getByRole('cell', { name: 'Mobile E2E Guest', exact: true })).toBeVisible()
})

test('completes add, edit, and delete guest flow', async ({ page }) => {
  await page.goto('/guests')
  await expect(mainRegion(page).getByRole('heading', { name: 'Guests', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Existing Guest', exact: true })).toBeVisible()

  // Add
  await mainRegion(page).getByRole('button', { name: 'Add Guest' }).click()
  await formDialog(page).getByLabel('Name', { exact: true }).fill('E2E Taylor')
  await formDialog(page).getByLabel('Email').fill('e2e.taylor@example.com')
  await selectOption(page, 'RSVP Status', 'Accepted')
  await formDialog(page).getByLabel('Table').fill('5')
  await formDialog(page).getByLabel('Seat').fill('3')
  await submitGuestForm(page, 'Add Guest')

  await expect(page.getByRole('status')).toHaveText('Guest added successfully.')
  await expect(page.getByRole('cell', { name: 'E2E Taylor', exact: true })).toBeVisible()

  // Edit
  await page.getByRole('button', { name: 'Edit E2E Taylor' }).click()
  await expect(formDialog(page).getByRole('heading', { name: 'Edit Guest' })).toBeVisible()
  await formDialog(page).getByLabel('Dietary', { exact: true }).fill('Vegan')
  await selectOption(page, 'RSVP Status', 'Tentative')
  await submitGuestForm(page, 'Save Guest')

  await expect(page.getByRole('status')).toHaveText('Guest updated successfully.')
  const taylorRow = page.getByRole('row', { name: /E2E Taylor/ })
  await expect(taylorRow.getByRole('cell', { name: 'tentative', exact: true })).toBeVisible()
  await expect(taylorRow.getByRole('cell', { name: 'Vegan', exact: true })).toBeVisible()

  // Delete
  await page.getByRole('button', { name: 'Delete E2E Taylor' }).click()
  await expect(formDialog(page).getByText('Delete E2E Taylor?')).toBeVisible()
  await formDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText('Guest deleted successfully.')
  await expect(page.getByRole('cell', { name: 'E2E Taylor', exact: true })).not.toBeVisible()
})

async function readDownloadedCsv(download: Download): Promise<string> {
  const filePath = await download.path()
  if (!filePath) {
    throw new Error('Download did not produce a file path')
  }
  return readFileSync(filePath, 'utf-8')
}

test('exports a single guest row as CSV', async ({ page }) => {
  await page.goto('/guests')
  await expect(page.getByRole('cell', { name: 'Existing Guest', exact: true })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Existing Guest' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('guest-existing-guest.csv')
  const content = await readDownloadedCsv(download)
  const lines = content.split('\r\n')
  expect(lines).toHaveLength(2)
  expect(lines[0]).toBe(
    'id,wedding_id,name,email,phone,address,relationship,rsvp_status,meal_choice,dietary_restrictions,plus_one_name,plus_one_rsvp,plus_one_dietary,table_number,seat_number,notes',
  )
  expect(lines[1]).toBe(
    '2001,1,Existing Guest,existing@example.com,555-0100,10 Guest Lane Halifax,friend,accepted,chicken,Gluten free,,,,1,2,Already invited',
  )
})

test('exports all guests as CSV with proper escaping', async ({ page }) => {
  const trickyGuest: Guest = {
    ...initialGuest,
    id: 2002,
    name: 'Comma, "Quoted" Guest',
    email: null,
    phone: null,
    address: null,
    relationship: null,
    meal_choice: null,
    dietary_restrictions: 'No nuts, "especially peanuts"\nsevere allergy',
    table_number: null,
    seat_number: null,
    notes: null,
  }

  await page.route(/\/api\/guests$/, async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, [initialGuest, trickyGuest])
      return
    }
    await route.fallback()
  })

  await page.goto('/guests')
  await expect(mainRegion(page).getByText('2 guests')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await mainRegion(page).getByRole('button', { name: 'Export all guests (CSV)' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('guests.csv')
  const content = await readDownloadedCsv(download)
  const lines = content.split('\r\n')
  expect(lines[0]).toBe(
    'id,wedding_id,name,email,phone,address,relationship,rsvp_status,meal_choice,dietary_restrictions,plus_one_name,plus_one_rsvp,plus_one_dietary,table_number,seat_number,notes',
  )
  expect(lines[1]).toBe(
    '2001,1,Existing Guest,existing@example.com,555-0100,10 Guest Lane Halifax,friend,accepted,chicken,Gluten free,,,,1,2,Already invited',
  )
  // Name and dietary notes contain commas, quotes, and a newline: they must be
  // quoted, with inner quotes doubled. Rows are joined with CRLF, so the
  // embedded LF stays inside the quoted dietary field on a single CRLF line.
  expect(lines[2]).toBe(
    '2002,1,"Comma, ""Quoted"" Guest",,,,,accepted,,"No nuts, ""especially peanuts""\nsevere allergy",,,,,,',
  )
  expect(lines).toHaveLength(3)
})

test('export all button is disabled while the list is empty', async ({ page }) => {
  await page.route(/\/api\/guests$/, async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, [])
      return
    }
    await route.fallback()
  })

  await page.goto('/guests')

  await expect(mainRegion(page).getByText('No guests found.')).toBeVisible()
  await expect(
    mainRegion(page).getByRole('button', { name: 'Export all guests (CSV)' }),
  ).toBeDisabled()
})

test('shows validation and API errors, then clears them after success', async ({ page }) => {
  await openAddGuestForm(page)

  await formDialog(page).getByLabel('Name', { exact: true }).fill('Error Case Guest')
  await formDialog(page).getByLabel('Table').fill('0')
  await submitGuestForm(page, 'Add Guest')
  await expect(formDialog(page).getByRole('alert')).toHaveText('Table number must be 1 or greater.')

  await formDialog(page).getByLabel('Table').fill('1')
  await formDialog(page).getByLabel('Email').fill('duplicate@example.com')
  await submitGuestForm(page, 'Add Guest')
  await expect(formDialog(page).getByRole('alert')).toHaveText('Duplicate email')

  await formDialog(page).getByLabel('Email').fill('error-case@example.com')
  await submitGuestForm(page, 'Add Guest')
  await expect(page.getByRole('status')).toHaveText('Guest added successfully.')
  await expect(page.getByRole('cell', { name: 'Error Case Guest', exact: true })).toBeVisible()
})

test('filters the guest list by search term and RSVP status', async ({ page }) => {
  await installGuestApi(page, [initialGuest, secondGuest])
  await page.goto('/guests')

  await expect(mainRegion(page).getByText('2 guests')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Existing Guest', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Alex Pending', exact: true })).toBeVisible()

  await page.getByLabel('Search guests').fill('alex')
  await expect(mainRegion(page).getByText('1 of 2 shown')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Alex Pending', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Existing Guest', exact: true })).not.toBeVisible()

  await page.getByLabel('Search guests').fill('')
  await page.getByLabel('Filter by RSVP status').click()
  await page.getByRole('option', { name: 'Accepted' }).click()
  await expect(mainRegion(page).getByText('1 of 2 shown')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Existing Guest', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Alex Pending', exact: true })).not.toBeVisible()
})

test('sets RSVP status in bulk for selected guests', async ({ page }) => {
  await installGuestApi(page, [initialGuest, secondGuest])
  await page.goto('/guests')

  await page.getByRole('checkbox', { name: 'Select all guests' }).check()
  await expect(page.getByText('2 selected')).toBeVisible()

  await page.getByLabel('Set RSVP status').click()
  await page.getByRole('option', { name: 'Declined' }).click()
  await mainRegion(page).getByRole('button', { name: 'Set RSVP status' }).click()

  await expect(page.getByRole('status')).toHaveText('Updated RSVP status for 2 guests.')
  const existingRow = page.getByRole('row', { name: /Existing Guest/ })
  const alexRow = page.getByRole('row', { name: /Alex Pending/ })
  await expect(existingRow.getByRole('cell', { name: 'declined', exact: true })).toBeVisible()
  await expect(alexRow.getByRole('cell', { name: 'declined', exact: true })).toBeVisible()
})

test('shows and edits plus-one details', async ({ page }) => {
  await installGuestApi(page, [initialGuest, secondGuest])
  await page.goto('/guests')

  // Alex already has a plus-one on file, so the section opens expanded.
  await page.getByRole('button', { name: 'Edit Alex Pending' }).click()
  const dialog = formDialog(page)
  await expect(dialog.getByLabel('Plus-one name')).toBeVisible()
  await expect(dialog.getByLabel('Plus-one name')).toHaveValue('Jordan Plus')
  await dialog.getByLabel('Plus-one dietary').fill('Shellfish and nut allergy')
  await submitGuestForm(page, 'Save Guest')
  await expect(page.getByRole('status')).toHaveText('Guest updated successfully.')

  // Existing Guest has no plus-one yet, so the section starts collapsed.
  await page.getByRole('button', { name: 'Edit Existing Guest' }).click()
  await expect(dialog.getByLabel('Plus-one name')).not.toBeVisible()
  await dialog.locator('summary').filter({ hasText: 'Plus-one details' }).click()
  await dialog.getByLabel('Plus-one name').fill('New Plus One')
  await submitGuestForm(page, 'Save Guest')
  await expect(page.getByRole('status')).toHaveText('Guest updated successfully.')
})

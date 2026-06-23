import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'tentative'
type MealChoice = 'chicken' | 'fish' | 'vegetarian'

interface Guest {
  id: number
  wedding_id: number
  name: string
  email: string | null
  phone: string | null
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

function guest(partial: Partial<Guest> & Pick<Guest, 'id' | 'name' | 'rsvp_status'>): Guest {
  return {
    wedding_id: 1,
    email: null,
    phone: null,
    relationship: null,
    meal_choice: null,
    dietary_restrictions: null,
    plus_one_name: null,
    plus_one_rsvp: null,
    plus_one_dietary: null,
    table_number: null,
    seat_number: null,
    notes: null,
    created_at: null,
    updated_at: null,
    ...partial,
  }
}

const guests: Guest[] = [
  guest({
    id: 1,
    name: 'Accepted Alice',
    rsvp_status: 'accepted',
    meal_choice: 'chicken',
    dietary_restrictions: 'Gluten free',
    plus_one_name: 'Bob',
  }),
  guest({ id: 2, name: 'Declined Dan', rsvp_status: 'declined' }),
  guest({ id: 3, name: 'Pending Pat', rsvp_status: 'pending', meal_choice: 'fish' }),
  guest({ id: 4, name: 'Accepted Ann', rsvp_status: 'accepted', meal_choice: 'chicken' }),
]

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status })
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        id: 1,
        name: 'Test Coordinator',
        role: 'coordinator',
        wedding_id: 1,
        invite_id: 1,
        guest_id: null,
      }),
    })
  })

  await page.route('**/api/guests', (route) => json(route, guests))
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [])
  expect(unexpectedErrors).toEqual([])
})

function mainRegion(page: Page) {
  return page.getByRole('main')
}

test('renders summary cards computed from the guest list', async ({ page }) => {
  await page.goto('/admin/rsvp')

  await expect(mainRegion(page).getByText('4 guests')).toBeVisible()

  const total = mainRegion(page).locator('div', { hasText: /^Total guests/ }).first()
  await expect(total).toContainText('4')

  const accepted = mainRegion(page).locator('div', { hasText: /^Accepted/ }).first()
  await expect(accepted).toContainText('2')

  const declined = mainRegion(page).locator('div', { hasText: /^Declined/ }).first()
  await expect(declined).toContainText('1')

  const pending = mainRegion(page).locator('div', { hasText: /^Pending/ }).first()
  await expect(pending).toContainText('1')

  // Meal-choice breakdown
  await expect(mainRegion(page).getByText('Chicken: 2')).toBeVisible()
  await expect(mainRegion(page).getByText('Fish: 1')).toBeVisible()
})

test('renders the guest table with status and details', async ({ page }) => {
  await page.goto('/admin/rsvp')

  for (const column of ['Name', 'Status', 'Meal', 'Dietary Notes', 'Plus One']) {
    await expect(page.locator('th').filter({ hasText: new RegExp(`^${column}$`) })).toBeVisible()
  }

  await expect(page.getByRole('cell', { name: 'Accepted Alice', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Gluten free', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Bob', exact: true })).toBeVisible()
})

test('filters the table by RSVP status', async ({ page }) => {
  await page.goto('/admin/rsvp')

  await page.getByLabel('Filter by status').click()
  await page.getByRole('option', { name: 'Declined' }).click()

  await expect(page.getByRole('cell', { name: 'Declined Dan', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Accepted Alice', exact: true })).not.toBeVisible()
  await expect(page.getByRole('cell', { name: 'Pending Pat', exact: true })).not.toBeVisible()

  // Switch back to all
  await page.getByLabel('Filter by status').click()
  await page.getByRole('option', { name: 'All' }).click()
  await expect(page.getByRole('cell', { name: 'Accepted Alice', exact: true })).toBeVisible()
})

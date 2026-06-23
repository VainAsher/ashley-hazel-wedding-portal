import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

interface BudgetItem {
  id: number
  wedding_id: number
  vendor_id: number | null
  vendor_name: string | null
  category_id: number | null
  category_name: string | null
  description: string | null
  estimated_cost: number | null
  actual_cost: number | null
  paid: boolean
  payment_date: string | null
  notes: string | null
  created_at: string | null
}

const categories = [
  { id: 10, category_name: 'Venue', description: null },
  { id: 11, category_name: 'Catering', description: null },
]

const vendors = [
  {
    id: 50,
    wedding_id: 1,
    vendor_name: 'Grand Hall',
    category_id: 10,
    category_name: 'Venue',
    contact_person: null,
    email: null,
    phone: null,
    website: null,
    contract_signed: true,
    notes: null,
    created_at: null,
  },
]

const initialItem: BudgetItem = {
  id: 4001,
  wedding_id: 1,
  vendor_id: 50,
  vendor_name: 'Grand Hall',
  category_id: 10,
  category_name: 'Venue',
  description: 'Venue deposit',
  estimated_cost: 5000,
  actual_cost: 4800,
  paid: true,
  payment_date: '2026-01-15',
  notes: null,
  created_at: null,
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status })
}

function summaryFrom(items: BudgetItem[]) {
  const total_estimated = items.reduce((sum, i) => sum + (i.estimated_cost ?? 0), 0)
  const total_actual = items.reduce((sum, i) => sum + (i.actual_cost ?? 0), 0)
  const total_paid = items.reduce((sum, i) => sum + (i.paid ? i.actual_cost ?? 0 : 0), 0)
  return {
    total_estimated,
    total_actual,
    total_paid,
    remaining: total_estimated - total_actual,
    by_category: [],
  }
}

async function installBudgetApi(page: Page) {
  let nextId = 5000
  let items = [{ ...initialItem }]

  await page.route('**/api/budget/categories', (route) => json(route, categories))
  await page.route('**/api/vendors', (route) => json(route, vendors))
  await page.route('**/api/budget/summary', (route) => json(route, summaryFrom(items)))

  await page.route(/\/api\/budget\/items(?:\/\d+)?$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const detailMatch = url.pathname.match(/\/api\/budget\/items\/(\d+)$/)

    if (url.pathname.endsWith('/api/budget/items') && method === 'GET') {
      await json(route, items)
      return
    }

    if (url.pathname.endsWith('/api/budget/items') && method === 'POST') {
      const payload = request.postDataJSON() as Partial<BudgetItem>
      const category = categories.find((c) => c.id === payload.category_id)
      const vendor = vendors.find((v) => v.id === payload.vendor_id)
      const item: BudgetItem = {
        ...initialItem,
        ...payload,
        id: nextId,
        category_name: category ? category.category_name : null,
        vendor_name: vendor ? vendor.vendor_name : null,
        created_at: null,
      } as BudgetItem
      nextId += 1
      items = [...items, item]
      await json(route, item, 201)
      return
    }

    if (detailMatch && method === 'PUT') {
      const itemId = Number(detailMatch[1])
      const payload = request.postDataJSON() as Partial<BudgetItem>
      const existing = items.find((i) => i.id === itemId)
      if (!existing) {
        await json(route, { detail: 'Item not found' }, 404)
        return
      }
      const category = categories.find((c) => c.id === payload.category_id)
      const vendor = vendors.find((v) => v.id === payload.vendor_id)
      const updated = {
        ...existing,
        ...payload,
        id: itemId,
        category_name: category ? category.category_name : existing.category_name,
        vendor_name: vendor ? vendor.vendor_name : existing.vendor_name,
      }
      items = items.map((i) => (i.id === itemId ? updated : i))
      await json(route, updated)
      return
    }

    if (detailMatch && method === 'DELETE') {
      const itemId = Number(detailMatch[1])
      items = items.filter((i) => i.id !== itemId)
      await json(route, { status: 'deleted', id: itemId })
      return
    }

    await json(route, { detail: 'Not found' }, 404)
  })
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

  await installBudgetApi(page)
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

async function selectOption(page: Page, triggerLabel: string, optionName: string) {
  await formDialog(page).getByLabel(triggerLabel).click()
  await page.getByRole('option', { name: optionName }).click()
}

test('renders summary cards, line item count, and table columns', async ({ page }) => {
  await page.goto('/admin/budget')

  await expect(mainRegion(page).getByText('Total estimated')).toBeVisible()
  await expect(mainRegion(page).getByText('Remaining')).toBeVisible()
  await expect(mainRegion(page).getByText('1 line items')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Venue deposit', exact: true })).toBeVisible()
  for (const column of ['Description', 'Category', 'Vendor', 'Estimated', 'Actual', 'Paid', 'Actions']) {
    await expect(page.locator('th').filter({ hasText: new RegExp(`^${column}$`) })).toBeVisible()
  }
})

test('validates required description before submit', async ({ page }) => {
  await page.goto('/admin/budget')
  await mainRegion(page).getByRole('button', { name: 'Add Item' }).click()
  await expect(formDialog(page)).toBeVisible()

  await formDialog(page).getByRole('button', { name: 'Add Item' }).click()

  await expect(formDialog(page).getByRole('alert')).toHaveText('Description is required.')
})

test('adds a budget item with category and vendor', async ({ page }) => {
  await page.goto('/admin/budget')
  await mainRegion(page).getByRole('button', { name: 'Add Item' }).click()

  await formDialog(page).getByLabel('Description').fill('Catering balance')
  await selectOption(page, 'Category', 'Catering')
  await selectOption(page, 'Vendor', 'Grand Hall')
  await formDialog(page).getByLabel('Estimated cost').fill('3000')
  await formDialog(page).getByLabel('Actual cost').fill('3100')

  await formDialog(page).getByRole('button', { name: 'Add Item' }).click()

  await expect(page.getByRole('status')).toHaveText('Budget item added successfully.')
  await expect(page.getByRole('cell', { name: 'Catering balance', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Catering', exact: true })).toBeVisible()
})

test('edits a budget item description', async ({ page }) => {
  await page.goto('/admin/budget')
  await page.getByRole('button', { name: 'Edit Venue deposit' }).click()
  await expect(formDialog(page).getByRole('heading', { name: 'Edit Budget Item' })).toBeVisible()

  await formDialog(page).getByLabel('Description').fill('Venue final payment')
  await formDialog(page).getByRole('button', { name: 'Save Item' }).click()

  await expect(page.getByRole('status')).toHaveText('Budget item updated successfully.')
  await expect(page.getByRole('cell', { name: 'Venue final payment', exact: true })).toBeVisible()
})

test('deletes the only budget item and shows empty state', async ({ page }) => {
  await page.goto('/admin/budget')

  await page.getByRole('button', { name: 'Delete Venue deposit' }).click()
  await expect(formDialog(page).getByText('Delete Venue deposit?')).toBeVisible()
  await formDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText('Budget item deleted successfully.')
  await expect(mainRegion(page).getByText('No budget items found.')).toBeVisible()
  await expect(mainRegion(page).getByText('0 line items')).toBeVisible()
})

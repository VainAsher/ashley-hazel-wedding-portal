import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

interface Vendor {
  id: number
  wedding_id: number
  vendor_name: string
  category_id: number | null
  category_name: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  website: string | null
  contract_signed: boolean
  notes: string | null
  created_at: string | null
}

const categories = [
  { id: 10, category_name: 'Photography', description: null },
  { id: 11, category_name: 'Florist', description: null },
]

const initialVendor: Vendor = {
  id: 6001,
  wedding_id: 1,
  vendor_name: 'Existing Vendor',
  category_id: 10,
  category_name: 'Photography',
  contact_person: 'Jane Lens',
  email: 'jane@example.com',
  phone: '555-0200',
  website: 'https://example.com',
  contract_signed: true,
  notes: null,
  created_at: null,
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status })
}

async function installVendorApi(page: Page) {
  let nextId = 7000
  let vendors = [{ ...initialVendor }]

  await page.route('**/api/budget/categories', (route) => json(route, categories))

  await page.route(/\/api\/vendors(?:\/\d+)?$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const detailMatch = url.pathname.match(/\/api\/vendors\/(\d+)$/)

    if (url.pathname.endsWith('/api/vendors') && method === 'GET') {
      await json(route, vendors)
      return
    }

    if (url.pathname.endsWith('/api/vendors') && method === 'POST') {
      const payload = request.postDataJSON() as Partial<Vendor>
      if (payload.email === 'duplicate@example.com') {
        await json(route, { detail: 'Duplicate vendor email' }, 400)
        return
      }
      const category = categories.find((c) => c.id === payload.category_id)
      const vendor: Vendor = {
        ...initialVendor,
        ...payload,
        id: nextId,
        category_name: category ? category.category_name : null,
        created_at: null,
      } as Vendor
      nextId += 1
      vendors = [...vendors, vendor]
      await json(route, vendor, 201)
      return
    }

    if (detailMatch && method === 'PUT') {
      const vendorId = Number(detailMatch[1])
      const payload = request.postDataJSON() as Partial<Vendor>
      const existing = vendors.find((v) => v.id === vendorId)
      if (!existing) {
        await json(route, { detail: 'Vendor not found' }, 404)
        return
      }
      const category = categories.find((c) => c.id === payload.category_id)
      const updated = {
        ...existing,
        ...payload,
        id: vendorId,
        category_name: category ? category.category_name : existing.category_name,
      }
      vendors = vendors.map((v) => (v.id === vendorId ? updated : v))
      await json(route, updated)
      return
    }

    if (detailMatch && method === 'DELETE') {
      const vendorId = Number(detailMatch[1])
      vendors = vendors.filter((v) => v.id !== vendorId)
      await json(route, { status: 'deleted', id: vendorId })
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

  await installVendorApi(page)
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

test('renders vendor count and table columns', async ({ page }) => {
  await page.goto('/admin/vendors')

  await expect(mainRegion(page).getByText('1 vendors')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Existing Vendor', exact: true })).toBeVisible()
  for (const column of ['Name', 'Category', 'Contact Person', 'Email', 'Phone', 'Contract', 'Actions']) {
    await expect(page.locator('th').filter({ hasText: new RegExp(`^${column}$`) })).toBeVisible()
  }
})

test('validates required vendor name before submit', async ({ page }) => {
  await page.goto('/admin/vendors')
  await mainRegion(page).getByRole('button', { name: 'Add Vendor' }).click()
  await expect(formDialog(page)).toBeVisible()

  await formDialog(page).getByRole('button', { name: 'Add Vendor' }).click()

  await expect(formDialog(page).getByRole('alert')).toHaveText('Vendor name is required.')
})

test('adds a vendor with a category', async ({ page }) => {
  await page.goto('/admin/vendors')
  await mainRegion(page).getByRole('button', { name: 'Add Vendor' }).click()

  await formDialog(page).getByLabel('Name').fill('Bloom Studio')
  await selectOption(page, 'Category', 'Florist')
  await formDialog(page).getByLabel('Email').fill('bloom@example.com')

  await formDialog(page).getByRole('button', { name: 'Add Vendor' }).click()

  await expect(page.getByRole('status')).toHaveText('Vendor added successfully.')
  await expect(page.getByRole('cell', { name: 'Bloom Studio', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Florist', exact: true })).toBeVisible()
})

test('edits a vendor contact person', async ({ page }) => {
  await page.goto('/admin/vendors')
  await page.getByRole('button', { name: 'Edit Existing Vendor' }).click()
  await expect(formDialog(page).getByRole('heading', { name: 'Edit Vendor' })).toBeVisible()

  await formDialog(page).getByLabel('Contact Person').fill('Updated Contact')
  await formDialog(page).getByRole('button', { name: 'Save Vendor' }).click()

  await expect(page.getByRole('status')).toHaveText('Vendor updated successfully.')
  await expect(page.getByRole('cell', { name: 'Updated Contact', exact: true })).toBeVisible()
})

test('deletes the only vendor and shows empty state', async ({ page }) => {
  await page.goto('/admin/vendors')

  await page.getByRole('button', { name: 'Delete Existing Vendor' }).click()
  await expect(formDialog(page).getByText('Delete Existing Vendor?')).toBeVisible()
  await formDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText('Vendor deleted successfully.')
  await expect(mainRegion(page).getByText('No vendors found.')).toBeVisible()
  await expect(mainRegion(page).getByText('0 vendors')).toBeVisible()
})

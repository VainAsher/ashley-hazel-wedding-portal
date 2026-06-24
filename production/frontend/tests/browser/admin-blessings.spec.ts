import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

interface BlessingAdmin {
  id: number
  author_name: string
  message: string
  hidden: boolean
  created_at: string
}

const initialBlessings: BlessingAdmin[] = [
  {
    id: 7001,
    author_name: 'Auntie Mabel',
    message: 'Wishing you a lifetime of joy!',
    hidden: false,
    created_at: '2026-06-20T10:00:00Z',
  },
  {
    id: 7002,
    author_name: 'Cousin Rob',
    message: 'Congrats you two!',
    hidden: true,
    created_at: '2026-06-19T09:00:00Z',
  },
]

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

async function installBlessingsApi(page: Page) {
  let blessings = initialBlessings.map((blessing) => ({ ...blessing }))

  await page.route(/\/api\/blessings\/(all|\d+)$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const detailMatch = url.pathname.match(/\/api\/blessings\/(\d+)$/)

    if (url.pathname.endsWith('/api/blessings/all') && method === 'GET') {
      await json(route, blessings)
      return
    }

    if (detailMatch && method === 'PATCH') {
      const blessingId = Number(detailMatch[1])
      const payload = request.postDataJSON() as { hidden: boolean }
      const existing = blessings.find((blessing) => blessing.id === blessingId)
      if (!existing) {
        await json(route, { detail: 'Blessing not found' }, 404)
        return
      }
      const updated = { ...existing, hidden: payload.hidden }
      blessings = blessings.map((blessing) =>
        blessing.id === blessingId ? updated : blessing,
      )
      await json(route, updated)
      return
    }

    if (detailMatch && method === 'DELETE') {
      const blessingId = Number(detailMatch[1])
      blessings = blessings.filter((blessing) => blessing.id !== blessingId)
      await json(route, { status: 'deleted', id: blessingId })
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

  await installBlessingsApi(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [])
  expect(unexpectedErrors).toEqual([])
})

function mainRegion(page: Page) {
  return page.getByRole('main')
}

function dialog(page: Page) {
  return page.getByRole('dialog')
}

test('renders blessings with counts and status badges', async ({ page }) => {
  await page.goto('/admin/blessings')

  await expect(mainRegion(page).getByText('2 total, 1 visible, 1 hidden')).toBeVisible()

  for (const column of ['Author', 'Message', 'Date', 'Status', 'Actions']) {
    await expect(page.locator('th').filter({ hasText: new RegExp(`^${column}$`) })).toBeVisible()
  }

  const mabelRow = page.getByRole('row', { name: /Auntie Mabel/ })
  await expect(mabelRow.getByText('Visible', { exact: true })).toBeVisible()

  const robRow = page.getByRole('row', { name: /Cousin Rob/ })
  await expect(robRow.getByText('Hidden', { exact: true })).toBeVisible()
})

test('hiding a visible blessing updates the badge', async ({ page }) => {
  await page.goto('/admin/blessings')

  const mabelRow = page.getByRole('row', { name: /Auntie Mabel/ })
  await expect(mabelRow.getByText('Visible', { exact: true })).toBeVisible()

  await page
    .getByRole('button', { name: 'Hide blessing from Auntie Mabel' })
    .click()

  await expect(page.getByRole('status')).toHaveText('Blessing is now hidden.')
  await expect(mabelRow.getByText('Hidden', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Unhide blessing from Auntie Mabel' }),
  ).toBeVisible()
})

test('unhiding a hidden blessing updates the badge', async ({ page }) => {
  await page.goto('/admin/blessings')

  const robRow = page.getByRole('row', { name: /Cousin Rob/ })
  await expect(robRow.getByText('Hidden', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Unhide blessing from Cousin Rob' }).click()

  await expect(page.getByRole('status')).toHaveText('Blessing is now visible.')
  await expect(robRow.getByText('Visible', { exact: true })).toBeVisible()
})

test('dismisses delete confirmation and keeps the blessing', async ({ page }) => {
  await page.goto('/admin/blessings')

  await page.getByRole('button', { name: 'Delete blessing from Auntie Mabel' }).click()
  await expect(dialog(page).getByText(/Delete the blessing from Auntie Mabel/)).toBeVisible()

  await dialog(page).getByRole('button', { name: 'Cancel' }).click()

  await expect(dialog(page)).not.toBeVisible()
  await expect(page.getByRole('cell', { name: 'Auntie Mabel', exact: true })).toBeVisible()
})

test('deleting a blessing removes the row', async ({ page }) => {
  await page.goto('/admin/blessings')

  await page.getByRole('button', { name: 'Delete blessing from Auntie Mabel' }).click()
  await dialog(page).getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText('Blessing deleted successfully.')
  await expect(page.getByRole('cell', { name: 'Auntie Mabel', exact: true })).not.toBeVisible()
  await expect(mainRegion(page).getByText('1 total, 0 visible, 1 hidden')).toBeVisible()
})

test('filters blessings by visibility', async ({ page }) => {
  await page.goto('/admin/blessings')

  await expect(page.getByRole('cell', { name: 'Auntie Mabel', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Cousin Rob', exact: true })).toBeVisible()

  // Visible only -> hides Cousin Rob
  await mainRegion(page).getByLabel('Filter by visibility').click()
  await page.getByRole('option', { name: /Visible/ }).click()
  await expect(page.getByRole('cell', { name: 'Auntie Mabel', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Cousin Rob', exact: true })).not.toBeVisible()

  // Hidden only -> hides Auntie Mabel
  await mainRegion(page).getByLabel('Filter by visibility').click()
  await page.getByRole('option', { name: /Hidden/ }).click()
  await expect(page.getByRole('cell', { name: 'Cousin Rob', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Auntie Mabel', exact: true })).not.toBeVisible()

  // Back to all
  await mainRegion(page).getByLabel('Filter by visibility').click()
  await page.getByRole('option', { name: /All/ }).click()
  await expect(page.getByRole('cell', { name: 'Auntie Mabel', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Cousin Rob', exact: true })).toBeVisible()
})

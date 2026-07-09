import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

interface WeddingSettings {
  id: number
  couple_names: string
  wedding_date: string
  ceremony_time: string | null
  ceremony_location: string | null
  reception_location: string | null
}

const initialSettings: WeddingSettings = {
  id: 1,
  couple_names: 'Ashley & Hazel',
  wedding_date: '2026-09-12',
  ceremony_time: '15:30:00',
  ceremony_location: 'Rose Garden',
  reception_location: 'Grand Hall',
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status })
}

const putPayloads: unknown[] = []

async function installSettingsApi(page: Page) {
  let settings = { ...initialSettings }
  putPayloads.length = 0

  await page.route('**/api/settings/wedding', async (route) => {
    const request = route.request()
    const method = request.method()

    if (method === 'GET') {
      await json(route, settings)
      return
    }

    if (method === 'PUT') {
      const payload = request.postDataJSON() as Partial<WeddingSettings>
      putPayloads.push(payload)
      settings = { ...settings, ...payload }
      await json(route, settings)
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

  await installSettingsApi(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [])
  expect(unexpectedErrors).toEqual([])
})

function mainRegion(page: Page) {
  return page.getByRole('main')
}

test('loads and populates the settings form from the API', async ({ page }) => {
  await page.goto('/admin/settings')

  await expect(mainRegion(page).getByLabel('Couple Names')).toHaveValue('Ashley & Hazel')
  await expect(mainRegion(page).getByLabel('Wedding Date')).toHaveValue('2026-09-12')
  await expect(mainRegion(page).getByLabel('Ceremony Time')).toHaveValue('15:30')
  await expect(mainRegion(page).getByLabel('Ceremony Location')).toHaveValue('Rose Garden')
  await expect(mainRegion(page).getByLabel('Reception Location')).toHaveValue('Grand Hall')
})

test('validates required couple names before saving', async ({ page }) => {
  await page.goto('/admin/settings')

  await mainRegion(page).getByLabel('Couple Names').fill('')
  await mainRegion(page).getByRole('button', { name: 'Save', exact: true }).click()

  await expect(mainRegion(page).getByRole('alert')).toHaveText('Couple names are required.')
})

test('edits and saves settings with success feedback', async ({ page }) => {
  await page.goto('/admin/settings')

  await mainRegion(page).getByLabel('Couple Names').fill('Ashley and Hazel Forever')
  await mainRegion(page).getByLabel('Reception Location').fill('Lakeside Pavilion')
  await mainRegion(page).getByRole('button', { name: 'Save', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText('Settings saved successfully.')

  // Reload reflects the persisted values from the mock backend.
  await page.goto('/admin/settings')
  await expect(mainRegion(page).getByLabel('Couple Names')).toHaveValue('Ashley and Hazel Forever')
  await expect(mainRegion(page).getByLabel('Reception Location')).toHaveValue('Lakeside Pavilion')
})

test('saves the guest-site theme dials', async ({ page }) => {
  await page.goto('/admin/settings')

  const main = mainRegion(page)
  await expect(main.getByRole('heading', { name: 'Guest Site Theme' })).toBeVisible()

  await main.getByLabel('Accent colour', { exact: true }).fill('#00aa88')
  await main.getByLabel('Deep colour', { exact: true }).fill('#102030')
  await main.getByLabel(/Photo tint strength/).fill('60')

  await main.getByRole('button', { name: 'Save theme' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Theme saved' }),
  ).toBeVisible()

  expect(putPayloads).toEqual([
    { theme: { primary: '#00aa88', secondary: '#102030', tint_opacity: 0.6 } },
  ])
})

test('resets the guest-site theme to defaults', async ({ page }) => {
  await page.goto('/admin/settings')

  await mainRegion(page).getByRole('button', { name: 'Reset to default' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Theme reset to the default look.' }),
  ).toBeVisible()

  expect(putPayloads).toEqual([{ theme: null }])
})

test('rejects an invalid hex colour before saving', async ({ page }) => {
  await page.goto('/admin/settings')

  const main = mainRegion(page)
  await main.getByLabel('Accent colour', { exact: true }).fill('purple')

  await expect(main.getByText('Use a six-digit hex colour, e.g. #f6c445')).toBeVisible()
  await expect(main.getByRole('button', { name: 'Save theme' })).toBeDisabled()
})

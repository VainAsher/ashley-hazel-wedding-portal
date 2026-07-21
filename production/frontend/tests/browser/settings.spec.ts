import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

interface WeddingSettings {
  id: number
  couple_names: string
  wedding_date: string
  ceremony_time: string | null
  ceremony_location: string | null
  reception_location: string | null
  meal_selection_open: boolean
  party_visibility_mode: 'partner_visible' | 'locked'
}

const initialSettings: WeddingSettings = {
  id: 1,
  couple_names: 'Ashley & Hazel',
  wedding_date: '2026-09-12',
  ceremony_time: '15:30:00',
  ceremony_location: 'Rose Garden',
  reception_location: 'Grand Hall',
  meal_selection_open: false,
  party_visibility_mode: 'partner_visible',
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

  // The Menu card (admin-menu.spec.ts covers its behaviour) fetches the
  // option list on mount; answer with an empty menu so this spec stays
  // focused on the settings form and theme card.
  await page.route('**/api/menu', async (route) => {
    await json(route, [])
  })
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)

  // The theme card loads Google font faces for its pickers/preview — keep the
  // suite deterministic and offline-safe by stubbing the stylesheet.
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  )

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

async function openSettingsTab(page: Page, label: string) {
  await mainRegion(page).getByRole('tab', { name: label }).click()
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
  await openSettingsTab(page, 'Look & Feel')

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
    {
      theme: {
        primary: '#00aa88',
        secondary: '#102030',
        tint_opacity: 0.6,
        display_font: 'Georgia',
        body_font: 'Inter',
        type_scale: 1,
        layout_mode: 'paged',
        page_backgrounds: {},
      },
    },
  ])
})

test('saves chosen fonts and type scale, and previews them live', async ({ page }) => {
  await page.goto('/admin/settings')
  await openSettingsTab(page, 'Look & Feel')

  const main = mainRegion(page)
  await expect(main.getByRole('heading', { name: 'Guest Site Theme' })).toBeVisible()

  // Pick a display face — the option list renders each face in its own font.
  await main.getByLabel('Headings font', { exact: true }).click()
  const playfairOption = page.getByRole('option', { name: 'Playfair Display' })
  await expect(playfairOption).toHaveCSS('font-family', /Playfair Display/)
  await playfairOption.click()

  await main.getByLabel('Text font', { exact: true }).click()
  await page.getByRole('option', { name: 'Nunito Sans' }).click()

  await main
    .getByRole('group', { name: 'Type scale' })
    .getByRole('button', { name: 'Roomy' })
    .click()

  // The live preview follows the dials immediately.
  await expect(page.getByTestId('theme-preview-heading')).toHaveCSS(
    'font-family',
    /Playfair Display/,
  )
  await expect(page.getByTestId('theme-preview-body')).toHaveCSS('font-family', /Nunito Sans/)
  await expect(page.getByTestId('theme-preview')).toHaveCSS('font-size', '17.6px') // 16px * 1.1

  await main.getByRole('button', { name: 'Save theme' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Theme saved' })).toBeVisible()

  expect(putPayloads).toEqual([
    {
      theme: {
        primary: '#f6c445',
        secondary: '#2b064d',
        tint_opacity: 0.9,
        display_font: 'Playfair Display',
        body_font: 'Nunito Sans',
        type_scale: 1.1,
        layout_mode: 'paged',
        page_backgrounds: {},
      },
    },
  ])
})

test('resets the guest-site theme to defaults', async ({ page }) => {
  await page.goto('/admin/settings')
  await openSettingsTab(page, 'Look & Feel')

  await mainRegion(page).getByRole('button', { name: 'Reset to default' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Theme reset to the default look.' }),
  ).toBeVisible()

  expect(putPayloads).toEqual([{ theme: null }])
})

test('rejects an invalid hex colour before saving', async ({ page }) => {
  await page.goto('/admin/settings')
  await openSettingsTab(page, 'Look & Feel')

  const main = mainRegion(page)
  await main.getByLabel('Accent colour', { exact: true }).fill('purple')

  await expect(main.getByText('Use a six-digit hex colour, e.g. #f6c445')).toBeVisible()
  await expect(main.getByRole('button', { name: 'Save theme' })).toBeDisabled()
})

test('renders the Guest Page Navigation card with the default paged mode selected', async ({
  page,
}) => {
  await page.goto('/admin/settings')
  await openSettingsTab(page, 'Guest Access')

  const main = mainRegion(page)
  await expect(main.getByRole('heading', { name: 'Guest Page Navigation' })).toBeVisible()

  const group = main.getByRole('radiogroup', { name: 'Guest page navigation' })
  await expect(group.getByRole('radio', { name: /Paged/ })).toBeChecked()
  await expect(group.getByRole('radio', { name: /Scroll/ })).not.toBeChecked()
})

test('switches guest page navigation to scroll and saves it', async ({ page }) => {
  await page.goto('/admin/settings')
  await openSettingsTab(page, 'Guest Access')

  const main = mainRegion(page)
  const group = main.getByRole('radiogroup', { name: 'Guest page navigation' })
  await group.getByRole('radio', { name: /Scroll/ }).click()

  await expect(
    page.getByRole('status').filter({ hasText: 'Guest page navigation saved.' }),
  ).toBeVisible()
  // layout_mode is nested in the theme JSONB (not its own top-level settings
  // field like party_visibility_mode), so the save merges it into the
  // existing (default) theme rather than sending a bare field.
  expect(putPayloads).toContainEqual({
    theme: {
      primary: '#f6c445',
      secondary: '#2b064d',
      tint_opacity: 0.9,
      display_font: 'Georgia',
      body_font: 'Inter',
      type_scale: 1.0,
      layout_mode: 'scroll',
      page_backgrounds: {},
    },
  })
  await expect(group.getByRole('radio', { name: /Scroll/ })).toBeChecked()
})

test('renders the Party Visibility card with the current mode selected', async ({ page }) => {
  await page.goto('/admin/settings')
  await openSettingsTab(page, 'Guest Access')

  const main = mainRegion(page)
  await expect(main.getByRole('heading', { name: 'Party Visibility' })).toBeVisible()

  const group = main.getByRole('radiogroup', { name: 'Party visibility' })
  await expect(group.getByRole('radio', { name: /Partner visible/ })).toBeChecked()
  await expect(group.getByRole('radio', { name: /Locked/ })).not.toBeChecked()
})

test('switches party visibility to locked and saves it', async ({ page }) => {
  await page.goto('/admin/settings')
  await openSettingsTab(page, 'Guest Access')

  const main = mainRegion(page)
  const group = main.getByRole('radiogroup', { name: 'Party visibility' })
  await group.getByRole('radio', { name: /Locked/ }).click()

  await expect(
    page.getByRole('status').filter({ hasText: 'Party visibility saved.' }),
  ).toBeVisible()
  expect(putPayloads).toContainEqual({ party_visibility_mode: 'locked' })
  await expect(group.getByRole('radio', { name: /Locked/ })).toBeChecked()
})

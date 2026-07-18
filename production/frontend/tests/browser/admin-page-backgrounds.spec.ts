import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

/**
 * ROADMAP item 18 (docs/specs/PAGE_BACKGROUNDS.md): the admin picker half
 * (PR 3/3) -- the guest-facing GuestLayout/AuthLayout consumption is covered
 * separately in page-backgrounds.spec.ts.
 */

interface WeddingThemeSettings {
  primary: string
  secondary: string
  tint_opacity: number
  display_font: string
  body_font: string
  type_scale: number
  layout_mode: string
  page_backgrounds: Record<string, unknown>
}

interface WeddingSettings {
  id: number
  couple_names: string
  wedding_date: string
  ceremony_time: string | null
  ceremony_location: string | null
  reception_location: string | null
  meal_selection_open: boolean
  party_visibility_mode: string
  theme: WeddingThemeSettings | null
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
  theme: null,
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

  await page.route('**/api/menu', async (route) => {
    await json(route, [])
  })

  await page.route('**/api/gallery/approved', async (route) => {
    await json(route, [
      {
        id: 7,
        wedding_id: 1,
        title: 'Beach walk',
        caption: null,
        file_path: 'x',
        thumb_path: null,
        content_type: 'image/jpeg',
        file_size: 1,
        status: 'approved',
        created_at: null,
        url: '/uploads/1/gallery/beach.jpg',
        thumb_url: '/uploads/1/gallery/beach-thumb.jpg',
      },
    ])
  })

  await page.route('**/api/settings/backgrounds/upload', async (route) => {
    await json(route, { url: '/uploads/1/backgrounds/uploaded-photo.jpg' })
  })
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)

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

function previewPhotoLayer(page: Page) {
  return page.getByTestId('background-preview-box').locator('div').first()
}

async function focalPercentFromStyle(page: Page): Promise<{ x: number; y: number }> {
  const style = await previewPhotoLayer(page).getAttribute('style')
  const match = style?.match(/background-position:\s*([\d.]+)%\s+([\d.]+)%/)
  if (!match) {
    throw new Error(`could not parse background-position from style: ${style}`)
  }
  return { x: Number(match[1]), y: Number(match[2]) }
}

test('renders the default stock photo for each page and switches independently', async ({
  page,
}) => {
  await page.goto('/admin/settings')
  const main = mainRegion(page)
  await expect(main.getByRole('heading', { name: 'Page Backgrounds' })).toBeVisible()

  await expect(previewPhotoLayer(page)).toHaveCSS(
    'background-image',
    /bg-02-registry-office\.jpg/,
  )

  await main.getByRole('tab', { name: 'RSVP' }).click()
  await expect(previewPhotoLayer(page)).toHaveCSS('background-image', /bg-03-waterfall\.jpg/)
})

test('edits to one page do not leak into another before saving', async ({ page }) => {
  await page.goto('/admin/settings')
  const main = mainRegion(page)

  await main.getByRole('button', { name: 'Evening sky' }).click()
  await expect(previewPhotoLayer(page)).toHaveCSS('background-image', /bg-05-evening-sky\.jpg/)

  await main.getByRole('tab', { name: 'Schedule' }).click()
  await expect(previewPhotoLayer(page)).toHaveCSS('background-image', /bg-04-woodland-walk\.jpg/)

  await main.getByRole('tab', { name: 'Dashboard' }).click()
  await expect(previewPhotoLayer(page)).toHaveCSS('background-image', /bg-05-evening-sky\.jpg/)
})

test('picks a stock photo, drags the focal point, zooms, saves, and the change persists across reload', async ({
  page,
}) => {
  await page.goto('/admin/settings')
  const main = mainRegion(page)

  await main.getByRole('button', { name: 'Evening sky' }).click()

  const box = page.getByTestId('background-preview-box')
  await box.scrollIntoViewIfNeeded()
  const bounds = await box.boundingBox()
  if (!bounds) {
    throw new Error('preview box not found')
  }
  await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + bounds.height * 0.8)
  await page.mouse.down()
  await page.mouse.up()

  const { x, y } = await focalPercentFromStyle(page)
  expect(x).toBeGreaterThan(15)
  expect(x).toBeLessThan(25)
  expect(y).toBeGreaterThan(75)
  expect(y).toBeLessThan(85)

  await main.getByLabel(/Zoom/).fill('180')
  await expect(previewPhotoLayer(page)).toHaveCSS('transform', 'matrix(1.8, 0, 0, 1.8, 0, 0)')

  await main.getByRole('button', { name: 'Save all backgrounds' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Page backgrounds saved.' }),
  ).toBeVisible()

  const lastPayload = putPayloads.at(-1) as { theme: WeddingThemeSettings }
  const savedDashboard = lastPayload.theme.page_backgrounds.dashboard as {
    source: string
    url: string
    zoom: number
  }
  expect(savedDashboard.source).toBe('stock')
  expect(savedDashboard.url).toBe('/backgrounds/bg-05-evening-sky.jpg')
  expect(savedDashboard.zoom).toBe(1.8)

  await page.goto('/admin/settings')
  await expect(previewPhotoLayer(page)).toHaveCSS('background-image', /bg-05-evening-sky\.jpg/)
  await expect(previewPhotoLayer(page)).toHaveCSS('transform', 'matrix(1.8, 0, 0, 1.8, 0, 0)')
})

test('picks a gallery photo, resetting focal point and zoom to neutral', async ({ page }) => {
  await page.goto('/admin/settings')
  const main = mainRegion(page)

  await main.getByRole('tab', { name: 'Gallery' }).click()
  await main.getByRole('button', { name: 'Beach walk' }).click()

  await expect(previewPhotoLayer(page)).toHaveCSS('background-image', /beach\.jpg/)
  await expect(previewPhotoLayer(page)).toHaveCSS('background-position', '50% 50%')
  await expect(previewPhotoLayer(page)).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
})

test('uploads a file and sets it as the background', async ({ page }) => {
  await page.goto('/admin/settings')
  const main = mainRegion(page)

  await main.getByRole('tab', { name: 'Upload' }).click()
  await main
    .getByLabel('Upload a background photo')
    .setInputFiles({
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-bytes'),
    })

  await expect(previewPhotoLayer(page)).toHaveCSS(
    'background-image',
    /uploaded-photo\.jpg/,
  )
})

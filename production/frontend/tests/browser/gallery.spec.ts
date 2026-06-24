import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

type GalleryStatus = 'pending' | 'approved' | 'rejected'

interface GalleryItem {
  id: number
  wedding_id: number
  title: string | null
  caption: string | null
  file_path: string
  content_type: string | null
  file_size: number | null
  status: GalleryStatus
  created_at: string | null
  url: string
}

const initialItem: GalleryItem = {
  id: 5001,
  wedding_id: 1,
  title: 'Existing Photo',
  caption: 'A lovely moment',
  file_path: '/uploads/1/existing.jpg',
  content_type: 'image/jpeg',
  file_size: 1024,
  status: 'approved',
  created_at: null,
  url: '/uploads/1/existing.jpg',
}

const pendingItem: GalleryItem = {
  id: 5002,
  wedding_id: 1,
  title: 'Pending Photo',
  caption: 'Awaiting review',
  file_path: '/uploads/1/pending.jpg',
  content_type: 'image/jpeg',
  file_size: 2048,
  status: 'pending',
  created_at: null,
  url: '/uploads/1/pending.jpg',
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

interface PatchRecord {
  id: number
  status?: GalleryStatus
}

const patchRequests: PatchRecord[] = []

async function installGalleryApi(page: Page) {
  let nextId = 6000
  let items: GalleryItem[] = [{ ...pendingItem }, { ...initialItem }]
  patchRequests.length = 0

  await page.route(/\/api\/gallery(?:\/\d+)?$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const detailMatch = url.pathname.match(/\/api\/gallery\/(\d+)$/)

    if (url.pathname.endsWith('/api/gallery') && method === 'GET') {
      await json(route, items)
      return
    }

    if (detailMatch && method === 'PATCH') {
      const itemId = Number(detailMatch[1])
      const payload = request.postDataJSON() as { status?: GalleryStatus }
      patchRequests.push({ id: itemId, status: payload.status })
      items = items.map((item) =>
        item.id === itemId ? { ...item, ...payload } : item,
      )
      const updated = items.find((item) => item.id === itemId)
      await json(route, updated ?? { detail: 'Not found' }, updated ? 200 : 404)
      return
    }

    if (url.pathname.endsWith('/api/gallery') && method === 'POST') {
      const id = nextId
      nextId += 1
      const item: GalleryItem = {
        id,
        wedding_id: 1,
        title: 'Uploaded Photo',
        caption: 'Freshly added',
        file_path: `/uploads/1/${id}.png`,
        content_type: 'image/png',
        file_size: 64,
        status: 'pending',
        created_at: null,
        url: `/uploads/1/${id}.png`,
      }
      // newest first
      items = [item, ...items]
      await json(route, item, 201)
      return
    }

    if (detailMatch && method === 'DELETE') {
      const itemId = Number(detailMatch[1])
      items = items.filter((item) => item.id !== itemId)
      await json(route, { status: 'deleted', id: itemId })
      return
    }

    await json(route, { detail: 'Not found' }, 404)
  })

  // Serve uploaded image paths so <img> requests don't error.
  await page.route('**/uploads/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64',
      ),
    })
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

  await installGalleryApi(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors)
  expect(unexpectedErrors).toEqual([])
})

function mainRegion(page: Page) {
  return page.getByRole('main')
}

function gallery(page: Page) {
  return page.getByRole('region', { name: 'Photo gallery' })
}

const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

test('renders existing gallery item and photo count', async ({ page }) => {
  await page.goto('/admin/gallery')

  await expect(mainRegion(page).getByText('2 photos · 1 pending review')).toBeVisible()
  await expect(gallery(page).getByRole('heading', { name: 'Existing Photo' })).toBeVisible()
  await expect(gallery(page).getByText('A lovely moment')).toBeVisible()
})

test('shows empty state when there are no photos', async ({ page }) => {
  await page.goto('/admin/gallery')

  // Delete every existing photo to reach the empty state.
  await page.getByRole('button', { name: 'Delete Existing Photo' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(gallery(page).getByRole('heading', { name: 'Existing Photo' })).not.toBeVisible()

  await page.getByRole('button', { name: 'Delete Pending Photo' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(mainRegion(page).getByText('No photos yet')).toBeVisible()
  await expect(mainRegion(page).getByText('0 photos · 0 pending review')).toBeVisible()
})

test('filters the queue by status with counts', async ({ page }) => {
  await page.goto('/admin/gallery')

  // Both photos visible under "All".
  await expect(gallery(page).getByRole('heading', { name: 'Existing Photo' })).toBeVisible()
  await expect(gallery(page).getByRole('heading', { name: 'Pending Photo' })).toBeVisible()

  // Filter to pending only.
  await mainRegion(page).getByRole('button', { name: 'Pending (1)' }).click()
  await expect(gallery(page).getByRole('heading', { name: 'Pending Photo' })).toBeVisible()
  await expect(gallery(page).getByRole('heading', { name: 'Existing Photo' })).not.toBeVisible()

  // Filter to rejected only -> empty.
  await mainRegion(page).getByRole('button', { name: 'Rejected (0)' }).click()
  await expect(mainRegion(page).getByText('No rejected photos')).toBeVisible()
})

test('approves a pending photo via PATCH', async ({ page }) => {
  await page.goto('/admin/gallery')

  await page.getByRole('button', { name: 'Approve Pending Photo' }).click()

  await expect(page.getByRole('status')).toHaveText('Pending Photo approved.')
  expect(patchRequests).toContainEqual({ id: 5002, status: 'approved' })

  // After approval the card no longer shows an Approve button.
  await expect(page.getByRole('button', { name: 'Approve Pending Photo' })).not.toBeVisible()
})

test('rejects a pending photo via PATCH', async ({ page }) => {
  await page.goto('/admin/gallery')

  await page.getByRole('button', { name: 'Reject Pending Photo' }).click()

  await expect(page.getByRole('status')).toHaveText('Pending Photo rejected.')
  expect(patchRequests).toContainEqual({ id: 5002, status: 'rejected' })
  await expect(page.getByRole('button', { name: 'Reject Pending Photo' })).not.toBeVisible()
})

test('validates that a file is selected before upload', async ({ page }) => {
  await page.goto('/admin/gallery')

  await mainRegion(page).getByRole('button', { name: 'Upload' }).click()

  await expect(mainRegion(page).getByRole('alert')).toHaveText(
    'Please select an image to upload.',
  )
})

test('uploads a photo and adds a card', async ({ page }) => {
  await page.goto('/admin/gallery')

  await page.getByLabel('Image').setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: PNG_BUFFER,
  })

  await mainRegion(page).getByRole('button', { name: 'Upload' }).click()

  await expect(page.getByRole('status')).toHaveText('Photo uploaded successfully.')
  await expect(gallery(page).getByRole('heading', { name: 'Uploaded Photo' })).toBeVisible()
  await expect(mainRegion(page).getByText('3 photos · 2 pending review')).toBeVisible()
})

test('deletes a photo and removes its card', async ({ page }) => {
  await page.goto('/admin/gallery')

  await expect(gallery(page).getByRole('heading', { name: 'Existing Photo' })).toBeVisible()

  await page.getByRole('button', { name: 'Delete Existing Photo' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Delete Existing Photo?')).toBeVisible()
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText('Photo deleted successfully.')
  await expect(gallery(page).getByRole('heading', { name: 'Existing Photo' })).not.toBeVisible()
})

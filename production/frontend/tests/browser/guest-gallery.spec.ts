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
  thumb_path: string | null
  content_type: string | null
  file_size: number | null
  status: GalleryStatus
  created_at: string | null
  url: string
  thumb_url: string | null
}

const approvedItem: GalleryItem = {
  id: 7001,
  wedding_id: 1,
  title: 'Sunset Toast',
  caption: 'Golden hour',
  file_path: '/uploads/1/sunset.jpg',
  thumb_path: '1/thumbs/sunset.jpg',
  content_type: 'image/jpeg',
  file_size: 1024,
  status: 'approved',
  created_at: null,
  url: '/uploads/1/sunset.jpg',
  thumb_url: '/uploads/1/thumbs/sunset.jpg',
}

const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

let submitCount = 0

async function installGuestGalleryApi(page: Page, approved: GalleryItem[]) {
  submitCount = 0

  await page.route('**/api/gallery/approved', async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, approved)
      return
    }
    await json(route, { detail: 'Not found' }, 404)
  })

  await page.route('**/api/gallery/submit', async (route) => {
    if (route.request().method() === 'POST') {
      submitCount += 1
      const item: GalleryItem = {
        id: 8000 + submitCount,
        wedding_id: 1,
        title: 'Guest Upload',
        caption: null,
        file_path: `/uploads/1/guest-${submitCount}.png`,
        thumb_path: null,
        content_type: 'image/png',
        file_size: 64,
        status: 'pending',
        created_at: null,
        url: `/uploads/1/guest-${submitCount}.png`,
        thumb_url: null,
      }
      await json(route, item, 201)
      return
    }
    await json(route, { detail: 'Not found' }, 404)
  })

  // Serve uploaded image paths so <img> requests don't error.
  await page.route('**/uploads/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: PNG_BUFFER,
    })
  })
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)

  await page.route('**/api/auth/me', async (route) => {
    await json(route, {
      id: 9,
      name: 'Wedding Guest',
      role: 'guest',
      wedding_id: 1,
      invite_id: 3,
      guest_id: 42,
    })
  })
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

test('shows approved photos in the guest gallery', async ({ page }) => {
  await installGuestGalleryApi(page, [{ ...approvedItem }])
  await page.goto('/gallery')

  // Photo labels render as figure captions, not headings.
  await expect(gallery(page).getByText('Sunset Toast')).toBeVisible()
  await expect(gallery(page).getByText('Golden hour')).toBeVisible()
})

test('opens a photo in the lightbox and closes with Escape', async ({ page }) => {
  await installGuestGalleryApi(page, [{ ...approvedItem }])
  await page.goto('/gallery')

  await gallery(page)
    .getByRole('button', { name: 'View photo full size: Sunset Toast' })
    .click()

  const lightbox = page.getByRole('dialog')
  await expect(lightbox).toBeVisible()
  await expect(lightbox.getByRole('img', { name: 'Sunset Toast' })).toBeVisible()
  await expect(lightbox.getByText('1 of 1')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(lightbox).toBeHidden()
})

test('grid renders the thumbnail while the lightbox keeps the original', async ({ page }) => {
  await installGuestGalleryApi(page, [{ ...approvedItem }])
  await page.goto('/gallery')

  // The grid <img> points at the ~480px thumbnail derivative.
  const gridImage = gallery(page).getByRole('img', { name: 'Sunset Toast' })
  await expect(gridImage).toHaveAttribute('src', '/uploads/1/thumbs/sunset.jpg')

  // The lightbox always shows the full-size original.
  await gallery(page)
    .getByRole('button', { name: 'View photo full size: Sunset Toast' })
    .click()
  const lightbox = page.getByRole('dialog')
  await expect(lightbox.getByRole('img', { name: 'Sunset Toast' })).toHaveAttribute(
    'src',
    '/uploads/1/sunset.jpg',
  )
})

test('grid falls back to the original when there is no thumbnail', async ({ page }) => {
  await installGuestGalleryApi(page, [{ ...approvedItem, thumb_path: null, thumb_url: null }])
  await page.goto('/gallery')

  const gridImage = gallery(page).getByRole('img', { name: 'Sunset Toast' })
  await expect(gridImage).toHaveAttribute('src', '/uploads/1/sunset.jpg')
})

test('shows empty state when there are no approved photos', async ({ page }) => {
  await installGuestGalleryApi(page, [])
  await page.goto('/gallery')

  await expect(mainRegion(page).getByText('No photos yet')).toBeVisible()
})

test('validates that a photo is selected before submitting', async ({ page }) => {
  await installGuestGalleryApi(page, [{ ...approvedItem }])
  await page.goto('/gallery')

  await mainRegion(page).getByRole('button', { name: 'Submit' }).click()

  await expect(mainRegion(page).getByRole('alert')).toHaveText('Please select a photo to share.')
})

test('submits a photo and shows the pending-approval message', async ({ page }) => {
  await installGuestGalleryApi(page, [{ ...approvedItem }])
  await page.goto('/gallery')

  await page.getByLabel('Photo', { exact: true }).setInputFiles({
    name: 'guest.png',
    mimeType: 'image/png',
    buffer: PNG_BUFFER,
  })

  await mainRegion(page).getByRole('button', { name: 'Submit' }).click()

  await expect(page.getByRole('status')).toHaveText(
    'Thanks! Your photo was submitted for approval.',
  )
  expect(submitCount).toBe(1)
})

import { expect, test, type Locator, type Page, type Route } from '@playwright/test'
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

const approvedVideo: GalleryItem = {
  id: 7002,
  wedding_id: 1,
  title: 'First Dance',
  caption: 'Reception',
  file_path: '/uploads/1/first-dance.mp4',
  thumb_path: null,
  content_type: 'video/mp4',
  file_size: 2048,
  status: 'approved',
  created_at: null,
  url: '/uploads/1/first-dance.mp4',
  thumb_url: null,
}

const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const MP4_BUFFER = Buffer.from('00000018667479706d703432000000006d70343269736f6d', 'hex')

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
      // Real content negotiation is covered by the backend tests; here we
      // just need a well-formed pending row so the UI's success path renders.
      const isVideo = (route.request().postData() ?? '').includes('video/mp4')
      const ext = isVideo ? 'mp4' : 'png'
      const item: GalleryItem = {
        id: 8000 + submitCount,
        wedding_id: 1,
        title: 'Guest Upload',
        caption: null,
        file_path: `/uploads/1/guest-${submitCount}.${ext}`,
        thumb_path: null,
        content_type: isVideo ? 'video/mp4' : 'image/png',
        file_size: 64,
        status: 'pending',
        created_at: null,
        url: `/uploads/1/guest-${submitCount}.${ext}`,
        thumb_url: null,
      }
      await json(route, item, 201)
      return
    }
    await json(route, { detail: 'Not found' }, 404)
  })

  // Serve uploaded media paths so <img>/<video> requests don't error.
  await page.route('**/uploads/**', async (route) => {
    const url = route.request().url()
    if (url.endsWith('.mp4')) {
      await route.fulfill({
        status: 200,
        contentType: 'video/mp4',
        body: MP4_BUFFER,
      })
      return
    }
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

// Gallery now renders inside a modal launched from the Celebrate hub
// (Blessings/Dancefloor/Gallery consolidated -- see Celebrate.tsx) rather
// than as its own standalone page; /gallery redirects to /celebrate.
async function openGallery(page: Page) {
  await page.goto('/celebrate')
  await page.getByRole('button', { name: 'Open Gallery' }).click()
  return page.getByRole('dialog')
}

async function openSharePhotoForm(dialog: Locator) {
  // <summary> isn't exposed with an accessible role of "button" in Chromium
  // -- target its text directly rather than getByRole.
  await dialog.getByText('Share a photo', { exact: true }).click()
}

test('shows the first approved photo directly, no click-to-open step', async ({ page }) => {
  await installGuestGalleryApi(page, [{ ...approvedItem }])
  const dialog = await openGallery(page)

  await expect(dialog.getByRole('img', { name: 'Sunset Toast' })).toBeVisible()
  await expect(dialog.getByText('Golden hour')).toBeVisible()
})

test('closes the gallery modal with Escape', async ({ page }) => {
  await installGuestGalleryApi(page, [{ ...approvedItem }])
  const dialog = await openGallery(page)
  await expect(dialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('hero shows the original photo while the filmstrip uses the thumbnail', async ({ page }) => {
  await installGuestGalleryApi(page, [{ ...approvedItem }])
  const dialog = await openGallery(page)

  await expect(dialog.getByRole('img', { name: 'Sunset Toast' })).toHaveAttribute(
    'src',
    '/uploads/1/sunset.jpg',
  )
  await expect(
    dialog.getByRole('button', { name: 'View photo 1 of 1: Sunset Toast' }).locator('img'),
  ).toHaveAttribute('src', '/uploads/1/thumbs/sunset.jpg')
})

test('filmstrip falls back to the original when there is no thumbnail', async ({ page }) => {
  await installGuestGalleryApi(page, [{ ...approvedItem, thumb_path: null, thumb_url: null }])
  const dialog = await openGallery(page)

  await expect(
    dialog.getByRole('button', { name: 'View photo 1 of 1: Sunset Toast' }).locator('img'),
  ).toHaveAttribute('src', '/uploads/1/sunset.jpg')
})

test('filmstrip and arrow-button navigation switch the hero photo', async ({ page }) => {
  const second: GalleryItem = {
    ...approvedItem,
    id: 7003,
    title: 'Cutting the Cake',
    caption: 'Reception',
    file_path: '/uploads/1/cake.jpg',
    url: '/uploads/1/cake.jpg',
    thumb_path: '1/thumbs/cake.jpg',
    thumb_url: '/uploads/1/thumbs/cake.jpg',
  }
  await installGuestGalleryApi(page, [{ ...approvedItem }, second])
  const dialog = await openGallery(page)

  await expect(dialog.getByRole('img', { name: 'Sunset Toast' })).toBeVisible()

  await dialog.getByRole('button', { name: 'View photo 2 of 2: Cutting the Cake' }).click()
  await expect(dialog.getByRole('img', { name: 'Cutting the Cake' })).toBeVisible()

  await dialog.getByRole('button', { name: 'Previous photo' }).click()
  await expect(dialog.getByRole('img', { name: 'Sunset Toast' })).toBeVisible()
})

test('shows empty state when there are no approved photos', async ({ page }) => {
  await installGuestGalleryApi(page, [])
  const dialog = await openGallery(page)

  await expect(dialog.getByText('No photos yet')).toBeVisible()
})

test('validates that a photo is selected before submitting', async ({ page }) => {
  await installGuestGalleryApi(page, [{ ...approvedItem }])
  const dialog = await openGallery(page)
  await openSharePhotoForm(dialog)

  await dialog.getByRole('button', { name: 'Share photo' }).click()

  await expect(dialog.getByRole('alert')).toHaveText('Please select a photo to share.')
})

test('submits a photo and shows the pending-approval message', async ({ page }) => {
  await installGuestGalleryApi(page, [{ ...approvedItem }])
  const dialog = await openGallery(page)
  await openSharePhotoForm(dialog)

  await dialog.getByLabel('Photo', { exact: true }).setInputFiles({
    name: 'guest.png',
    mimeType: 'image/png',
    buffer: PNG_BUFFER,
  })

  await dialog.getByRole('button', { name: 'Share photo' }).click()

  await expect(dialog.getByRole('status')).toHaveText(
    'Thanks! Your photo was submitted for approval.',
  )
  expect(submitCount).toBe(1)
})

test('upload hint mentions video support and the 150MB cap', async ({ page }) => {
  await installGuestGalleryApi(page, [{ ...approvedItem }])
  const dialog = await openGallery(page)
  await openSharePhotoForm(dialog)

  await expect(dialog.getByText('Photos or short videos (MP4), up to 150 MB.')).toBeVisible()
})

test('shows an approved video as a play-tile in the filmstrip and plays directly in the hero', async ({
  page,
}) => {
  await installGuestGalleryApi(page, [{ ...approvedVideo }])
  const dialog = await openGallery(page)

  const filmstripButton = dialog.getByRole('button', { name: 'View photo 1 of 1: First Dance' })
  await expect(filmstripButton).toBeVisible()
  // No thumbnail exists for video, so no <img> is rendered in the tile.
  await expect(filmstripButton.locator('img')).toHaveCount(0)

  // The hero plays the video directly -- no click-to-open step.
  const video = dialog.locator('video')
  await expect(video).toHaveAttribute('src', '/uploads/1/first-dance.mp4')
  await expect(video).toHaveAttribute('controls', '')
})

test('submits a video and shows the pending-approval message', async ({ page }) => {
  await installGuestGalleryApi(page, [{ ...approvedItem }])
  const dialog = await openGallery(page)
  await openSharePhotoForm(dialog)

  await dialog.getByLabel('Photo', { exact: true }).setInputFiles({
    name: 'clip.mp4',
    mimeType: 'video/mp4',
    buffer: MP4_BUFFER,
  })

  await dialog.getByRole('button', { name: 'Share photo' }).click()

  await expect(dialog.getByRole('status')).toHaveText(
    'Thanks! Your photo was submitted for approval.',
  )
  expect(submitCount).toBe(1)
})

import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

interface MemberProfile {
  invite_id: number
  display_name: string | null
  role_title: string | null
  about: string | null
  best_known_for: string | null
  favourite_song: string | null
  photo_path: string | null
  photo_url: string | null
  updated_at: string | null
}

interface ProfileDirectoryEntry {
  invite_id: number
  party: 'stag' | 'hen'
  display_name: string
  role_title: string | null
  about: string | null
  best_known_for: string | null
  favourite_song: string | null
  photo_path: string | null
  photo_url: string | null
  has_profile: boolean
}

const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status })
}

function emptyProfile(inviteId: number): MemberProfile {
  return {
    invite_id: inviteId,
    display_name: null,
    role_title: null,
    about: null,
    best_known_for: null,
    favourite_song: null,
    photo_path: null,
    photo_url: null,
    updated_at: null,
  }
}

const directory: ProfileDirectoryEntry[] = [
  {
    invite_id: 101,
    party: 'stag',
    display_name: 'Best Man Ben',
    role_title: 'Best Man',
    about: 'Loves a good pint.',
    best_known_for: 'Legendary toasts',
    favourite_song: null,
    photo_path: null,
    photo_url: null,
    has_profile: true,
  },
  {
    invite_id: 102,
    party: 'stag',
    display_name: 'Plain Guest Pete',
    role_title: null,
    about: null,
    best_known_for: null,
    favourite_song: null,
    photo_path: null,
    photo_url: null,
    has_profile: false,
  },
  {
    invite_id: 201,
    party: 'hen',
    display_name: 'Maid of Honour Maya',
    role_title: 'Maid of Honour',
    about: null,
    best_known_for: 'Organising everything',
    favourite_song: 'Dancing Queen',
    photo_path: null,
    photo_url: null,
    has_profile: true,
  },
]

async function installProfilesApi(
  page: Page,
  { myProfile, directoryEntries }: { myProfile: MemberProfile | null; directoryEntries: ProfileDirectoryEntry[] },
) {
  let currentProfile = myProfile

  await page.route('**/api/profiles/me', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      if (currentProfile === null) {
        await json(route, { detail: 'Not eligible for a profile' }, 404)
        return
      }
      await json(route, currentProfile)
      return
    }
    if (method === 'PUT') {
      if (currentProfile === null) {
        await json(route, { detail: 'Not authorized' }, 403)
        return
      }
      const body = route.request().postDataJSON() as Partial<MemberProfile>
      currentProfile = { ...currentProfile, ...body }
      await json(route, currentProfile)
      return
    }
    await route.continue()
  })

  await page.route('**/api/profiles/me/photo', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    if (currentProfile === null) {
      await json(route, { detail: 'Not authorized' }, 403)
      return
    }
    currentProfile = { ...currentProfile, photo_url: '/uploads/1/profiles/me.png' }
    await json(route, currentProfile)
  })

  await page.route('**/api/profiles', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    await json(route, directoryEntries)
  })

  // Serve uploaded image paths so <img> requests don't error.
  await page.route('**/uploads/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'image/png', body: PNG_BUFFER })
  })
}

async function mockGuestAuth(page: Page, overrides: Partial<Record<string, unknown>> = {}) {
  await page.route('**/api/auth/me', async (route) => {
    await json(route, {
      id: 5,
      name: 'Plain Guest Pete',
      role: 'guest',
      wedding_id: 1,
      invite_id: 102,
      guest_id: 5,
      wedding_phase: 'live',
      ...overrides,
    })
  })
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  // A 404 from /api/profiles/me is the expected, correct response for an
  // ineligible viewer -- not a bug to fail the suite over.
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [
    'the server responded with a status of 404',
  ])
  expect(unexpectedErrors).toEqual([])
})

function mainRegion(page: Page) {
  return page.getByRole('main')
}

test.describe('nav visibility', () => {
  test('Wedding Party nav entry is visible even when the guest has no party', async ({ page }) => {
    await mockGuestAuth(page)
    await installProfilesApi(page, { myProfile: null, directoryEntries: directory })
    await page.route('**/api/party/access', (route) =>
      json(route, { stag: false, hen: false }),
    )
    await page.goto('/dashboard')

    await expect(page.getByRole('link', { name: 'Wedding Party' })).toBeVisible()
  })

  test('Wedding Party nav entry is visible when the guest is a party member', async ({ page }) => {
    await mockGuestAuth(page, { invite_id: 101 })
    await installProfilesApi(page, {
      myProfile: emptyProfile(101),
      directoryEntries: directory,
    })
    await page.route('**/api/party/access', (route) => json(route, { stag: true, hen: false }))
    await page.goto('/dashboard')

    await expect(page.getByRole('link', { name: 'Wedding Party' })).toBeVisible()
  })
})

test.describe('public directory', () => {
  test('renders all party members grouped by party', async ({ page }) => {
    await mockGuestAuth(page)
    await installProfilesApi(page, { myProfile: null, directoryEntries: directory })
    await page.goto('/wedding-party')

    const main = mainRegion(page)
    await expect(main.getByRole('heading', { name: 'Stag Do' })).toBeVisible()
    await expect(main.getByRole('heading', { name: 'Hen Do' })).toBeVisible()

    const stagSection = main.getByRole('region', { name: 'Stag Do' })
    await expect(stagSection.getByText('Best Man Ben')).toBeVisible()
    await expect(stagSection.getByText('Legendary toasts')).toBeVisible()
    // Unfilled member still renders, via the guest-name fallback.
    await expect(stagSection.getByText('Plain Guest Pete')).toBeVisible()

    const henSection = main.getByRole('region', { name: 'Hen Do' })
    await expect(henSection.getByText('Maid of Honour Maya')).toBeVisible()
    await expect(henSection.getByText('Organising everything')).toBeVisible()
  })

  test('a guest not in the party does not see the editor', async ({ page }) => {
    await mockGuestAuth(page)
    await installProfilesApi(page, { myProfile: null, directoryEntries: directory })
    await page.goto('/wedding-party')

    await expect(mainRegion(page).getByRole('heading', { name: 'My profile' })).toHaveCount(0)
  })
})

test.describe('editor', () => {
  test('an eligible member can edit and save their profile', async ({ page }) => {
    await mockGuestAuth(page, { invite_id: 101 })
    await installProfilesApi(page, {
      myProfile: emptyProfile(101),
      directoryEntries: directory,
    })
    await page.goto('/wedding-party')

    const main = mainRegion(page)
    await expect(main.getByRole('heading', { name: 'My profile' })).toBeVisible()

    await main.getByLabel('Display name').fill('Ben the Best Man')
    await main.getByLabel('Role title').fill('Best Man')
    await main.getByLabel('Best known for').fill('Legendary toasts')
    await main.getByRole('button', { name: 'Save' }).click()

    await expect(main.getByText('Your profile has been saved.')).toBeVisible()
  })

  test('photo upload updates the preview', async ({ page }) => {
    await mockGuestAuth(page, { invite_id: 101 })
    await installProfilesApi(page, {
      myProfile: emptyProfile(101),
      directoryEntries: directory,
    })
    await page.goto('/wedding-party')

    const main = mainRegion(page)
    await main.getByLabel('Photo').setInputFiles({
      name: 'me.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    })

    await expect(main.getByText('Photo updated.')).toBeVisible()
    await expect(main.locator('img[src*="/uploads/1/profiles/me.png"]')).toBeVisible()
  })
})

import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'tentative'

interface Guest {
  id: number
  wedding_id: number
  name: string
  email: string | null
  phone: string | null
  relationship: string | null
  rsvp_status: RsvpStatus
  meal_choice: string | null
  dietary_notes: string | null
  dietary_restrictions: string | null
  plus_one_name: string | null
  plus_one_rsvp: RsvpStatus | null
  plus_one_dietary: string | null
  plus_one_meal_choice: string | null
  table_number: number | null
  seat_number: number | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

interface PatchRequestRecord {
  rsvp_status?: RsvpStatus
  meal_choice?: string | null
  plus_one_meal_choice?: string | null
  dietary_notes?: string | null
  plus_one_name?: string | null
}

interface PortalMenuOption {
  id: number
  name: string
  description: string | null
  course: string | null
  is_vegetarian: boolean
  is_vegan: boolean
  is_gluten_free: boolean
}

interface PortalMenu {
  meal_selection_open: boolean
  options: PortalMenuOption[]
}

// Default: meal selection closed — today's dietary-only behaviour.
const closedMenu: PortalMenu = { meal_selection_open: false, options: [] }

function menuOption(
  partial: Partial<PortalMenuOption> & Pick<PortalMenuOption, 'id' | 'name'>,
): PortalMenuOption {
  return {
    description: null,
    course: null,
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    ...partial,
  }
}

const openMenu: PortalMenu = {
  meal_selection_open: true,
  options: [
    menuOption({ id: 1, name: 'Herb Roast Chicken' }),
    menuOption({ id: 2, name: 'Wild Mushroom Wellington', is_vegetarian: true, is_vegan: true }),
    menuOption({ id: 3, name: 'Grilled Sea Bass', is_gluten_free: true }),
  ],
}

const currentUser = {
  id: 10,
  name: 'Demo Guest',
  role: 'guest',
  wedding_id: 1,
  invite_id: 20,
  guest_id: 10,
}

const initialGuest: Guest = {
  id: 10,
  wedding_id: 1,
  name: 'Demo Guest',
  email: 'demo@example.com',
  phone: null,
  relationship: 'friend',
  rsvp_status: 'accepted',
  meal_choice: 'vegetarian',
  dietary_notes: 'No nuts',
  dietary_restrictions: null,
  plus_one_name: 'Demo Plus One',
  plus_one_rsvp: null,
  plus_one_dietary: null,
  plus_one_meal_choice: null,
  table_number: null,
  seat_number: null,
  notes: null,
  created_at: null,
  updated_at: null,
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

async function trackBrowserErrors(page: Page) {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))
  Reflect.set(page, 'browserErrors', browserErrors)
}

async function installRsvpApi(
  page: Page,
  options: {
    guest?: Guest
    menu?: PortalMenu
    patchStatus?: number
    patchDetail?: string
    requests?: PatchRequestRecord[]
  } = {},
) {
  let guest = { ...(options.guest ?? initialGuest) }

  await page.route('**/api/auth/me', async (route) => {
    await json(route, currentUser)
  })

  await page.route('**/api/portal/menu', async (route) => {
    await json(route, options.menu ?? closedMenu)
  })

  await page.route(/\/api\/guests\/10$/, async (route) => {
    const method = route.request().method()

    if (method === 'GET') {
      await json(route, guest)
      return
    }

    if (method === 'PATCH') {
      const payload = route.request().postDataJSON() as PatchRequestRecord
      options.requests?.push(payload)

      if (options.patchStatus && options.patchStatus >= 400) {
        await json(route, { detail: options.patchDetail ?? 'Unable to save RSVP' }, options.patchStatus)
        return
      }

      guest = { ...guest, ...payload }
      await json(route, guest)
      return
    }

    await json(route, { detail: 'Not found' }, 404)
  })
}

test.beforeEach(async ({ page }) => {
  // Clean up any previous test state
  await cleanupPageState(page)
  await initializeErrorTracking(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [
    'the server responded with a status of 400',
  ])
  expect(unexpectedErrors).toEqual([])
})

test('does not fetch /api/auth/me from the page itself', async ({ page }) => {
  await installRsvpApi(page)

  let authMeRequests = 0
  page.on('request', (request) => {
    if (request.url().includes('/api/auth/me')) {
      authMeRequests += 1
    }
  })

  await page.goto('/rsvp')
  await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible()
  await expect(page.getByLabel('Accept')).toBeChecked()

  // Exactly two callers remain on a page load: the app-wide AuthProvider and
  // the RequireGuestOrCouple route guard shared by every paged-layout route
  // (see App.tsx's PagedGuestLayoutRoute). The RSVP page reads the shared
  // auth context instead of issuing a third, duplicate fetch, and GuestLayout
  // restores the guest-only restriction by reading that same context rather
  // than mounting a second guard. React StrictMode double-fires mount effects
  // on the dev server Playwright runs against, so each caller counts twice
  // (2 callers x 2 = 4). A page-level fetch would push this to 6.
  expect(authMeRequests).toBe(4)
})

test('renders current guest RSVP state', async ({ page }) => {
  await installRsvpApi(page)

  await page.goto('/rsvp')

  // Check heading and guest name (get the main one in the card, not header)
  await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible()
  await expect(page.getByRole('main').getByText('Demo Guest')).toBeVisible()

  // Check attendance status
  await expect(page.getByLabel('Accept')).toBeChecked()

  // Check dietary details (visible when accepted; meal choice opens later)
  await expect(page.getByLabel('Dietary requirements')).toHaveValue('No nuts')
  await expect(page.getByLabel('Plus One Name')).toHaveValue('Demo Plus One')
})

test('submits RSVP changes and locks the saved form', async ({ page }) => {
  const requests: PatchRequestRecord[] = []
  await installRsvpApi(page, {
    guest: {
      ...initialGuest,
      rsvp_status: 'pending',
      meal_choice: null,
      dietary_notes: null,
      plus_one_name: null,
    },
    requests,
  })

  await page.goto('/rsvp')

  // Change to accepted first to show the dietary section
  await page.getByLabel('Accept').check()

  await page.getByLabel('Dietary requirements').fill('Dairy-free')
  await page.getByLabel('Plus One Name').fill('Taylor Guest')

  // Submit the form
  await page.getByRole('button', { name: 'Save RSVP' }).click()

  // Verify success - wait for success alert to appear
  await expect(page.locator('[role="alert"]').filter({ hasText: 'RSVP saved.' })).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: 'Saved' })).toBeDisabled()
  await expect(page.getByLabel('Accept')).toBeDisabled()

  // Verify API received correct data — meal_choice is intentionally absent
  // while menu selection is closed, so any stored choice is preserved.
  expect(requests).toEqual([
    {
      rsvp_status: 'accepted',
      dietary_notes: 'Dairy-free',
      plus_one_name: 'Taylor Guest',
    },
  ])
})

test('shows API errors without leaving the form', async ({ page }) => {
  await installRsvpApi(page, {
    patchDetail: 'Unable to save RSVP',
    patchStatus: 400,
  })

  await page.goto('/rsvp')

  // Change status to declined
  await page.getByLabel('Decline').check()
  await page.getByRole('button', { name: 'Save RSVP' }).click()

  // Verify error is shown
  const alerts = page.getByRole('alert')
  await expect(alerts).not.toHaveCount(0)
  await expect(alerts.first()).toContainText('Unable to save RSVP')

  // Verify form remains enabled for retry
  await expect(page.getByRole('button', { name: 'Save RSVP' })).toBeEnabled()
  await expect(page.getByLabel('Decline')).toBeEnabled()
})

test('hides dietary section when not accepting invitation', async ({ page }) => {
  await installRsvpApi(page)

  await page.goto('/rsvp')

  // Initially, guest is accepted so the dietary section is visible
  await expect(page.getByLabel('Dietary requirements')).toBeVisible()

  // Change to declined - the dietary section should disappear
  await page.getByLabel('Decline').check()
  await expect(page.getByLabel('Dietary requirements')).not.toBeVisible()

  // Change back to accepted - the dietary section should reappear
  await page.getByLabel('Accept').check()
  await expect(page.getByLabel('Dietary requirements')).toBeVisible()
})

test('hides meal selects while meal selection is closed', async ({ page }) => {
  // Default mock menu is closed — this is today's behaviour and must stay.
  await installRsvpApi(page)

  await page.goto('/rsvp')

  await expect(page.getByLabel('Dietary requirements')).toBeVisible()
  await expect(page.getByLabel('Your meal')).toHaveCount(0)
  await expect(page.getByLabel('Plus one meal')).toHaveCount(0)
  // The "opens nearer the day" copy stays while the menu is closed.
  await expect(page.getByText('Menu choices open nearer the day', { exact: false })).toBeVisible()
})

test('shows meal selects when meal selection is open', async ({ page }) => {
  await installRsvpApi(page, { menu: openMenu })

  await page.goto('/rsvp')

  await expect(page.getByLabel('Your meal')).toBeVisible()
  // Plus-one select appears because the guest has a plus one named.
  await expect(page.getByLabel('Plus one meal')).toBeVisible()
  await expect(page.getByText('Menu choices open nearer the day', { exact: false })).not.toBeVisible()

  // The select is populated from the portal menu.
  await page.getByLabel('Your meal').click()
  for (const name of ['Herb Roast Chicken', 'Wild Mushroom Wellington', 'Grilled Sea Bass']) {
    await expect(page.getByRole('option', { name })).toBeVisible()
  }
  await page.keyboard.press('Escape')
})

test('hides the plus-one meal select when no plus one is named', async ({ page }) => {
  await installRsvpApi(page, {
    guest: { ...initialGuest, plus_one_name: null },
    menu: openMenu,
  })

  await page.goto('/rsvp')

  await expect(page.getByLabel('Your meal')).toBeVisible()
  await expect(page.getByLabel('Plus one meal')).toHaveCount(0)
})

test('submits meal choices for guest and plus one while open', async ({ page }) => {
  const requests: PatchRequestRecord[] = []
  await installRsvpApi(page, {
    guest: {
      ...initialGuest,
      rsvp_status: 'pending',
      meal_choice: null,
      dietary_notes: null,
      plus_one_name: 'Demo Plus One',
      plus_one_meal_choice: null,
    },
    menu: openMenu,
    requests,
  })

  await page.goto('/rsvp')

  await page.getByLabel('Accept').check()

  await page.getByLabel('Your meal').click()
  await page.getByRole('option', { name: 'Herb Roast Chicken' }).click()

  await page.getByLabel('Plus one meal').click()
  await page.getByRole('option', { name: 'Wild Mushroom Wellington' }).click()

  await page.getByLabel('Dietary requirements').fill('No nuts')

  await page.getByRole('button', { name: 'Save RSVP' }).click()
  await expect(page.locator('[role="alert"]').filter({ hasText: 'RSVP saved.' })).toBeVisible({ timeout: 5000 })

  expect(requests).toEqual([
    {
      rsvp_status: 'accepted',
      dietary_notes: 'No nuts',
      plus_one_name: 'Demo Plus One',
      meal_choice: 'Herb Roast Chicken',
      plus_one_meal_choice: 'Wild Mushroom Wellington',
    },
  ])
})

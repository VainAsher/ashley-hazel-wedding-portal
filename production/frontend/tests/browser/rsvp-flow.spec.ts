import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'tentative'

interface AuthUser {
  id: number
  name: string
  role: 'guest' | 'coordinator' | 'couple'
  wedding_id: number
  invite_id: number
  guest_id: number
}

interface Guest {
  id: number
  wedding_id: number
  name: string
  email: string | null
  rsvp_status: RsvpStatus
  meal_choice: string | null
  dietary_notes: string | null
  plus_one_name: string | null
}

interface LoginRequestRecord {
  invite_code: string
}

interface PatchRequestRecord {
  rsvp_status?: RsvpStatus
  meal_choice?: string | null
  dietary_notes?: string | null
  plus_one_name?: string | null
}

// Use live backend if LIVE_E2E=1
const LIVE_E2E = process.env.LIVE_E2E === '1'

// Test data: Use DEMO-001 for mocked tests
const TEST_INVITE_CODE = 'DEMO-001'
const TEST_GUEST_NAME = 'Test Guest'

// For live tests, we'll use email prefix for cleanup
const LIVE_E2E_EMAIL_PREFIX = 'e2e-rsvp-'

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

test.beforeEach(async ({ page }) => {
  // Clean up any previous test state
  await cleanupPageState(page)
  await initializeErrorTracking(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [
    'the server responded with a status of 401',
    'net::ERR_FAILED',
  ])
  expect(unexpectedErrors).toEqual([])
})

if (LIVE_E2E) {
  test('full RSVP flow: invite login → form submission → persistence (LIVE)', async ({ page }) => {
    // Step 1: Navigate to root, should redirect to /invite
    await page.goto('/')
    await expect(page).toHaveURL(/\/invite$/)

    // Step 2: Enter invite code and submit
    await page.getByLabel('Invite Code').fill(TEST_INVITE_CODE)
    await page.getByRole('button', { name: 'Enter' }).click()

    // Step 3: Login lands on the dashboard; go to the RSVP form to continue.
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10000 })
    await page.goto('/rsvp')

    // Step 4: Verify guest name appears in the form (in main content, not header)
    await expect(page.getByRole('main').getByText(TEST_GUEST_NAME)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible()

    // Step 5: Fill out the RSVP form
    const mealChoice = 'fish'
    const dietaryNotes = 'Gluten-free'
    const plusOneName = 'Live Test Plus One'

    // Accept to show meal preferences
    await page.getByLabel('Accept').check()

    // Meal preferences should now be visible
    await expect(page.getByLabel('Meal Choice')).toBeVisible()

    // Fill out preferences
    await page.getByLabel('Meal Choice').selectOption(mealChoice)
    await page.getByLabel('Dietary Notes').fill(dietaryNotes)
    await page.getByLabel('Plus One Name').fill(plusOneName)

    // Step 6: Submit the form
    await page.getByRole('button', { name: 'Save RSVP' }).click()

    // Step 7: Verify success message
    await expect(page.locator('[role="alert"]').filter({ hasText: 'RSVP saved.' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: 'Saved' })).toBeDisabled()

    // Step 8: Reload page and verify persistence
    await page.reload()
    await expect(page).toHaveURL(/\/rsvp$/)

    // Step 9: Verify form shows saved state after reload
    await expect(page.getByLabel('Accept')).toBeChecked()
    await expect(page.getByLabel('Meal Choice')).toHaveValue(mealChoice)
    await expect(page.getByLabel('Dietary Notes')).toHaveValue(dietaryNotes)
    await expect(page.getByLabel('Plus One Name')).toHaveValue(plusOneName)
  })

  test('invalid invite code shows error (LIVE)', async ({ page }) => {
    await page.goto('/invite')

    const invalidCode = 'INVALID-CODE-12345'
    await page.getByLabel('Invite Code').fill(invalidCode)
    await page.getByRole('button', { name: 'Enter' }).click()

    // Should show error and stay on invite page
    await expect(page).toHaveURL(/\/invite$/)
    await expect(page.getByRole('alert')).toContainText('Code not found')
  })
} else {
  // Mocked tests for CI/CD (no live backend required)
  test('full RSVP flow: invite login → form submission (MOCKED)', async ({ page }) => {
    // Mock auth endpoints
    let authUser: AuthUser | null = null

    await page.route('**/api/auth/login', async (route) => {
      const payload = route.request().postDataJSON() as LoginRequestRecord
      if (payload.invite_code === TEST_INVITE_CODE) {
        authUser = {
          id: 1,
          name: TEST_GUEST_NAME,
          role: 'guest',
          wedding_id: 1,
          invite_id: 1,
          guest_id: 1,
        }
        // /api/auth/login returns a LoginResponse ({ user }), matching the real
        // backend; the bare user object is what GET /api/auth/me returns.
        await json(route, { user: authUser })
      } else {
        await json(route, { detail: 'Code not found' }, 401)
      }
    })

    await page.route('**/api/auth/me', async (route) => {
      if (authUser) {
        await json(route, authUser)
      } else {
        await json(route, { detail: 'Unauthorized' }, 401)
      }
    })

    // Mock guest RSVP endpoint
    let guestState: Guest = {
      id: 1,
      wedding_id: 1,
      name: TEST_GUEST_NAME,
      email: 'demo-001@wedding.local',
      rsvp_status: 'pending',
      meal_choice: null,
      dietary_notes: null,
      plus_one_name: null,
    }

    const patchRequests: PatchRequestRecord[] = []

    await page.route('**/api/guests/1', async (route) => {
      const method = route.request().method()

      if (method === 'GET') {
        if (!authUser) {
          await json(route, { detail: 'Unauthorized' }, 401)
          return
        }
        await json(route, guestState)
        return
      }

      if (method === 'PATCH') {
        if (!authUser) {
          await json(route, { detail: 'Unauthorized' }, 401)
          return
        }
        const payload = route.request().postDataJSON() as PatchRequestRecord
        patchRequests.push(payload)
        guestState = { ...guestState, ...payload }
        await json(route, guestState)
        return
      }

      await json(route, { detail: 'Not found' }, 404)
    })

    await page.route('**/api/auth/logout', async (route) => {
      authUser = null
      await json(route, { detail: 'OK' })
    })

    // Guests land on the dashboard after login; mock its data so the brief
    // dashboard render is clean before we head to the RSVP form.
    await page.route('**/api/portal/wedding', async (route) => {
      await json(route, {
        couple_names: TEST_GUEST_NAME,
        wedding_date: '2027-06-19',
        ceremony_time: '14:00:00',
        ceremony_location: 'The Chapel',
        reception_location: 'The Hall',
        phase: 'live',
      })
    })
    await page.route('**/api/portal/schedule', async (route) => {
      await json(route, [])
    })

    // Step 1: Navigate to root, should redirect to /invite
    await page.goto('/')
    await expect(page).toHaveURL(/\/invite$/)

    // Step 2: Enter invite code
    await page.getByLabel('Invite Code').fill(TEST_INVITE_CODE)
    await page.getByRole('button', { name: 'Enter' }).click()

    // Step 3: Login lands on the dashboard; go to the RSVP form to continue.
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 5000 })
    await page.goto('/rsvp')

    // Step 4: Verify guest name and form (in main content, not header)
    await expect(page.getByRole('main').getByText(TEST_GUEST_NAME)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible()

    // Step 5: Fill out form
    await page.getByLabel('Accept').check()

    // Meal preferences should now be visible
    await expect(page.getByLabel('Meal Choice')).toBeVisible()

    // Fill out preferences
    await page.getByLabel('Meal Choice').selectOption('fish')
    await page.getByLabel('Dietary Notes').fill('Gluten-free')
    await page.getByLabel('Plus One Name').fill('Mocked Plus One')

    // Step 6: Submit
    await page.getByRole('button', { name: 'Save RSVP' }).click()

    // Step 7: Verify success
    await expect(page.locator('[role="alert"]').filter({ hasText: 'RSVP saved.' })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: 'Saved' })).toBeDisabled()

    // Verify PATCH was called
    expect(patchRequests).toHaveLength(1)
    expect(patchRequests[0]).toEqual({
      rsvp_status: 'accepted',
      meal_choice: 'fish',
      dietary_notes: 'Gluten-free',
      plus_one_name: 'Mocked Plus One',
    })

    // Step 8: Reload and verify persistence (state should still be in guestState mock)
    await page.reload()
    await expect(page).toHaveURL(/\/rsvp$/)
    await expect(page.getByLabel('Accept')).toBeChecked()
    await expect(page.getByLabel('Meal Choice')).toHaveValue('fish')
    await expect(page.getByLabel('Dietary Notes')).toHaveValue('Gluten-free')
    await expect(page.getByLabel('Plus One Name')).toHaveValue('Mocked Plus One')
  })

  test('invalid invite code shows error (MOCKED)', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      const payload = route.request().postDataJSON() as LoginRequestRecord
      if (payload.invite_code === TEST_INVITE_CODE) {
        await json(route, { id: 1, name: TEST_GUEST_NAME, role: 'guest' })
      } else {
        await json(route, { detail: 'Code not found' }, 401)
      }
    })

    await page.goto('/invite')

    await page.getByLabel('Invite Code').fill('INVALID-CODE')
    await page.getByRole('button', { name: 'Enter' }).click()

    // Should stay on invite page and show error
    await expect(page).toHaveURL(/\/invite$/)
    await expect(page.getByRole('alert')).toContainText('Code not found')
  })

  test('guest cannot modify form after logout', async ({ page }) => {
    let authUser: AuthUser | null = {
      id: 1,
      name: TEST_GUEST_NAME,
      role: 'guest',
      wedding_id: 1,
      invite_id: 1,
      guest_id: 1,
    }

    await page.route('**/api/auth/me', async (route) => {
      if (authUser) {
        await json(route, authUser)
      } else {
        await json(route, { detail: 'Unauthorized' }, 401)
      }
    })

    await page.route('**/api/auth/logout', async (route) => {
      authUser = null
      await json(route, { detail: 'OK' })
    })

    await page.route('**/api/guests/1', async (route) => {
      if (!authUser) {
        await json(route, { detail: 'Unauthorized' }, 401)
        return
      }
      await json(route, {
        id: 1,
        wedding_id: 1,
        name: TEST_GUEST_NAME,
        email: 'demo@example.com',
        rsvp_status: 'pending',
        meal_choice: null,
        dietary_notes: null,
        plus_one_name: null,
      })
    })

    // Go to RSVP while authenticated
    await page.goto('/rsvp')
    await expect(page.getByRole('heading', { name: 'RSVP' })).toBeVisible()

    // Simulate logout (auth fails, redirects to invite)
    authUser = null

    // Reload should redirect to invite
    await page.reload()
    await expect(page).toHaveURL(/\/invite$/, { timeout: 5000 })
  })
}

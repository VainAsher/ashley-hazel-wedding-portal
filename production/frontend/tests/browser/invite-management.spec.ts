import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

type AuthRole = 'couple' | 'coordinator' | 'guest'

interface AuthUser {
  id: number
  name: string
  role: AuthRole
  wedding_id: number
  invite_id: number
  guest_id: number | null
}

type PartyValue = 'stag' | 'hen' | null

interface Invite {
  id: number
  code: string
  wedding_id: number
  role: string
  guest_id: number | null
  household_name: string | null
  created_at: string
  party?: PartyValue
  party_admin?: boolean
  party_title?: string | null
  partner_label?: string | null
  associated_party?: PartyValue
}

interface Guest {
  id: number
  name: string
  email: string | null
}

const coupleUser: AuthUser = {
  id: 30,
  name: 'Ashley & Hazel',
  role: 'couple',
  wedding_id: 1,
  invite_id: 40,
  guest_id: null,
}

const existingInvites: Invite[] = [
  {
    id: 1,
    code: 'DEMO-001',
    wedding_id: 1,
    role: 'guest',
    guest_id: 10,
    household_name: null,
    created_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 2,
    code: 'DEMO-COUPLE',
    wedding_id: 1,
    role: 'couple',
    guest_id: null,
    household_name: null,
    created_at: '2026-06-01T10:05:00Z',
  },
  {
    id: 3,
    code: 'DEMO-COORD',
    wedding_id: 1,
    role: 'coordinator',
    guest_id: 11,
    household_name: null,
    created_at: '2026-06-01T10:10:00Z',
  },
]

const existingGuests: Guest[] = [
  { id: 10, name: 'Demo Guest 1', email: 'guest1@example.com' },
  { id: 11, name: 'Demo Guest 2', email: 'guest2@example.com' },
  { id: 12, name: 'Unlinked Guest', email: null },
]

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

async function mockAuthenticatedCouple(page: Page) {
  // Mock the login endpoint to accept DEMO-COUPLE and return couple user
  await page.route(/\/api\/auth\/login(?:\?.*)?$/, async (route) => {
    const body = route.request().postDataJSON() as { invite_code: string }
    if (body.invite_code === 'DEMO-COUPLE') {
      return await json(route, { user: coupleUser }, 200)
    } else {
      return await json(route, { detail: 'Invalid invite code' }, 401)
    }
  })

  // Mock the /api/auth/me endpoint to return authenticated couple user
  await page.route(/\/api\/auth\/me(?:\?.*)?$/, async (route) => {
    return await json(route, coupleUser)
  })
}

async function mockInvites(page: Page, invites: Invite[] = existingInvites) {
  // Make a deep copy of invites array to avoid mutation issues across tests
  const invitesCopy = invites.map((i) => ({ ...i }))

  await page.route(/\/api\/invites(?:\/\d+)?(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url())

    // Handle GET /api/invites?wedding_id=1
    if (route.request().method() === 'GET' && url.search.includes('wedding_id')) {
      return await json(route, invitesCopy)
    }

    // Handle GET /api/invites/:id
    const match = url.pathname.match(/\/api\/invites\/(\d+)$/)
    if (route.request().method() === 'GET' && match) {
      const id = parseInt(match[1])
      const invite = invitesCopy.find(i => i.id === id)
      if (invite) {
        return await json(route, invite)
      } else {
        return await json(route, { detail: 'Invite not found' }, 404)
      }
    }

    // Handle POST /api/invites - generate new invite
    if (route.request().method() === 'POST') {
      let body: {
        wedding_id?: number
        role?: string
        party?: PartyValue
        party_admin?: boolean
        party_title?: string | null
        partner_label?: string | null
        associated_party?: PartyValue
      } = {}
      try {
        body = route.request().postDataJSON()
      } catch (e) {
        const postData = route.request().postData()
        if (postData) {
          body = JSON.parse(postData)
        }
      }

      if (!body.wedding_id || !body.role) {
        return await json(route, { detail: 'Missing wedding_id or role' }, 400)
      }

      const PARTY_ADMIN_TITLE: Record<'stag' | 'hen', string> = {
        stag: 'Best Man',
        hen: 'Maid of Honour',
      }

      const newInvite: Invite = {
        id: Math.max(...invitesCopy.map(i => i.id), 0) + 1,
        code: `NEW-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        wedding_id: body.wedding_id,
        role: body.role,
        guest_id: null,
        household_name: null,
        created_at: new Date().toISOString(),
        party: body.party ?? null,
        party_admin: body.party_admin ?? false,
        party_title:
          body.party_title ?? (body.party_admin && body.party ? PARTY_ADMIN_TITLE[body.party] : null),
        partner_label: body.partner_label ?? null,
        associated_party: body.associated_party ?? null,
      }
      // Best Man/MoH: up to 2 per party, reject a 3rd (matches the real
      // backend's MAX_PARTY_ADMINS_PER_PARTY cap in app/api/invites.py).
      if (newInvite.party_admin && newInvite.party) {
        const existingHolders = invitesCopy.filter(
          (i) => i.party === newInvite.party && i.party_admin,
        )
        if (existingHolders.length >= 2) {
          return await json(
            route,
            {
              detail:
                'This party already has 2 Best Man/Maid of Honours — remove one before adding another.',
            },
            400,
          )
        }
      }
      invitesCopy.unshift(newInvite)
      return await json(route, newInvite, 201)
    }

    // Handle PATCH /api/invites/:id - link guest / edit wedding party fields
    const patchMatch = url.pathname.match(/\/api\/invites\/(\d+)$/)
    if (route.request().method() === 'PATCH' && patchMatch) {
      const id = parseInt(patchMatch[1])
      let body: {
        guest_id?: number
        party?: PartyValue
        party_admin?: boolean
        party_title?: string | null
        partner_label?: string | null
        associated_party?: PartyValue
      } = {}
      try {
        body = route.request().postDataJSON()
      } catch (e) {
        // If body parsing fails, try to extract from postData
        const postData = route.request().postData()
        if (postData) {
          body = JSON.parse(postData)
        }
      }
      const invite = invitesCopy.find(i => i.id === id)
      if (invite) {
        if (body.guest_id !== undefined) {
          invite.guest_id = body.guest_id
        }
        if ('party' in body) {
          invite.party = body.party ?? null
        }
        if ('partner_label' in body) {
          invite.partner_label = body.partner_label ?? null
        }
        if ('associated_party' in body) {
          invite.associated_party = body.associated_party ?? null
        }
        if ('party_admin' in body) {
          const wantsAdmin = body.party_admin ?? false
          if (wantsAdmin && !invite.party_admin && invite.party) {
            const existingHolders = invitesCopy.filter(
              (i) => i.id !== invite.id && i.party === invite.party && i.party_admin,
            )
            if (existingHolders.length >= 2) {
              return await json(
                route,
                {
                  detail:
                    'This party already has 2 Best Man/Maid of Honours — remove one before adding another.',
                },
                400,
              )
            }
          }
          invite.party_admin = wantsAdmin
        }
        return await json(route, invite)
      } else {
        return await json(route, { detail: 'Invite not found' }, 404)
      }
    }

    // Handle PUT /api/invites/:id - link guest to invite (alternative to PATCH)
    const putMatch = url.pathname.match(/\/api\/invites\/(\d+)$/)
    if (route.request().method() === 'PUT' && putMatch) {
      const id = parseInt(putMatch[1])
      let body: { guest_id?: number } = {}
      try {
        body = route.request().postDataJSON() as { guest_id?: number }
      } catch (e) {
        const postData = route.request().postData()
        if (postData) {
          body = JSON.parse(postData)
        }
      }
      const invite = invitesCopy.find(i => i.id === id)
      if (invite) {
        if (body.guest_id !== undefined) {
          invite.guest_id = body.guest_id
        }
        return await json(route, invite)
      } else {
        return await json(route, { detail: 'Invite not found' }, 404)
      }
    }

    // Handle DELETE /api/invites/:id
    const deleteMatch = url.pathname.match(/\/api\/invites\/(\d+)$/)
    if (route.request().method() === 'DELETE' && deleteMatch) {
      const id = parseInt(deleteMatch[1])
      const index = invitesCopy.findIndex(i => i.id === id)
      if (index !== -1) {
        invitesCopy.splice(index, 1)
        return await json(route, null, 204)
      } else {
        return await json(route, { detail: 'Invite not found' }, 404)
      }
    }
  })
}

async function mockGuests(page: Page, initialGuests: Guest[] = existingGuests) {
  // Create a fresh copy of guests for each test to prevent state bleed
  const guests = initialGuests.map(g => ({ ...g }))

  await page.route(/\/api\/guests(?:\/\d+)?(?:\?.*)?$/, async (route) => {
    // Only mock GET requests; other methods continue to next handler
    if (route.request().method() === 'GET') {
      return await json(route, guests)
    }
    // Let other request methods pass through
    await route.continue()
  })
}

test.beforeEach(async ({ page }) => {
  // Clean up any previous test state
  await cleanupPageState(page)
  await initializeErrorTracking(page)

  // Set up all mocks BEFORE any navigation
  // Use Promise.all to ensure all routes are registered before proceeding
  await Promise.all([
    mockAuthenticatedCouple(page),
    mockInvites(page),
    mockGuests(page),
  ])

  // Navigate to admin directly (mocked auth will handle the session)
  await page.goto('/admin', { waitUntil: 'domcontentloaded' })

  // Wait for admin dashboard to load
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({ timeout: 10000 })

  // Wait for invites table to load - this ensures the data has been fetched and rendered
  await expect(page.locator('table')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 })

  // Scroll to top to ensure clean state
  await page.evaluate(() => window.scrollTo(0, 0))
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [
    'the server responded with a status of 401',
    'the server responded with a status of 500',
    'net::ERR_FAILED',
  ])
  expect(unexpectedErrors).toEqual([])
})

test('renders Invite Management UI with all sections', async ({ page }) => {
  // Check header (page is already at /admin after beforeEach auth setup)
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()

  // Check Generate New Invite form section
  await expect(page.getByRole('heading', { name: 'Generate New Invite' })).toBeVisible()
  await expect(page.getByLabel('Role')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate Code' })).toBeVisible()

  // Check role selector has expected options
  const roleSelect = page.getByLabel('Role')
  // Verify that the select exists
  await expect(roleSelect).toBeVisible()
  // Options in a native <select> element are always hidden in the DOM
  // Just verify they exist by checking the page HTML contains them
  const pageContent = await page.content()
  expect(pageContent).toContain('<option value="guest">Guest</option>')
  expect(pageContent).toContain('<option value="coordinator">Coordinator</option>')
  expect(pageContent).toContain('<option value="couple">Couple</option>')
})

test('displays existing invites in a table', async ({ page }) => {
  // Check table header (page is already at /admin after beforeEach auth setup)
  // <th> elements should be visible
  await expect(page.locator('th:has-text("Code")')).toBeVisible()
  await expect(page.locator('th:has-text("Role")')).toBeVisible()
  await expect(page.locator('th:has-text("Guest")')).toBeVisible()
  await expect(page.locator('th:has-text("Created")')).toBeVisible()
  await expect(page.locator('th:has-text("Actions")')).toBeVisible()

  // Check DEMO-001 invite
  await expect(page.getByText('DEMO-001')).toBeVisible()
  // Find the row with DEMO-001 and verify it has 'guest' role in it
  const demoRow = page.locator('tbody tr', { has: page.locator('text=DEMO-001') })
  await expect(demoRow.locator('td:nth-child(2)')).toContainText('guest')
  await expect(page.getByText('Demo Guest 1')).toBeVisible()

  // Check DEMO-COUPLE invite
  await expect(page.getByText('DEMO-COUPLE')).toBeVisible()

  // Check DEMO-COORD invite
  await expect(page.getByText('DEMO-COORD')).toBeVisible()

  // Check invites count
  const heading = page.getByRole('heading', { name: /Invites \(\d+\)/ })
  await expect(heading).toBeVisible()
  await expect(heading).toContainText('Invites (3)')
})

test('provides copy-to-clipboard buttons for codes', async ({ page }) => {
  // Find the first invite row and look for copy button (page is already at /admin)
  // First ensure table is loaded
  await expect(page.locator('table tbody')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('DEMO-001')).toBeVisible({ timeout: 5000 })

  const tableRows = page.locator('tbody tr')
  const firstRow = tableRows.nth(0)

  // The copy button (📋) should be near the code
  const copyButton = firstRow.locator('button', { hasText: '📋' })
  await expect(copyButton).toBeVisible({ timeout: 5000 })

  // Click copy button and check for success message
  await copyButton.click()
  await expect(page.getByText(/Copied:/)).toBeVisible()
})

test('shows link guest modal when clicking link button', async ({ page }) => {
  // Find an unlinked invite (one with 'Unlinked' text) (page is already at /admin)
  // DEMO-001 is linked, DEMO-COUPLE is unlinked, DEMO-COORD is linked

  // First ensure table is loaded
  await expect(page.locator('table tbody')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('DEMO-COUPLE')).toBeVisible({ timeout: 5000 })

  const tableRows = page.locator('tbody tr')

  // Find the row with unlinked invite
  const unlinkedRow = tableRows.filter({
    has: page.locator('text=DEMO-COUPLE')
  }).nth(0)

  // Click the link button (🔗)
  const linkButton = unlinkedRow.locator('button', { hasText: '🔗' })
  await expect(linkButton).toBeVisible({ timeout: 5000 })
  await linkButton.click({ force: true })

  // Check modal appears
  await expect(page.getByRole('heading', { name: 'Link Guest to Invite' })).toBeVisible()
  await expect(page.getByLabel('Select Guest')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Link Guest' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
})

test('generates a new invite code', async ({ page }) => {
  // Select a role (page is already at /admin)
  const roleSelect = page.getByLabel('Role')
  await roleSelect.selectOption('coordinator')

  // Click generate button
  const generateButton = page.getByRole('button', { name: 'Generate Code' })
  await generateButton.click()

  // Wait for success message
  await expect(page.getByText(/Invite code generated:/)).toBeVisible()

  // Verify new invite appears in table
  await expect(page.getByText(/Invites \(4\)/)).toBeVisible()
})

test('links a guest to an invite through modal', async ({ page }) => {
  // Find unlinked invite DEMO-COUPLE (page is already at /admin)
  // First ensure table is loaded
  await expect(page.locator('table tbody')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('DEMO-COUPLE')).toBeVisible({ timeout: 5000 })

  const tableRows = page.locator('tbody tr')
  const unlinkedRow = tableRows.filter({
    hasText: 'DEMO-COUPLE'
  }).nth(0)

  // Click link button
  const linkButton = unlinkedRow.locator('button', { hasText: '🔗' })
  await expect(linkButton).toBeVisible({ timeout: 5000 })
  await linkButton.click({ force: true })

  // Wait for modal
  await expect(page.getByRole('heading', { name: 'Link Guest to Invite' })).toBeVisible()

  // Select a guest
  const guestSelect = page.getByLabel('Select Guest')
  await guestSelect.selectOption('12') // Unlinked Guest

  // Click Link Guest button
  await page.getByRole('button', { name: 'Link Guest' }).click()

  // Check success message
  await expect(page.getByText('Guest linked to invite')).toBeVisible()

  // Modal should close
  await expect(page.getByRole('heading', { name: 'Link Guest to Invite' })).not.toBeVisible()

  // Verify guest is now linked in the table
  const updatedRow = tableRows.filter({
    has: page.locator('text=DEMO-COUPLE')
  }).nth(0)
  await expect(updatedRow.locator('text=Unlinked Guest')).toBeVisible()
})

test('closes modal when clicking cancel button', async ({ page }) => {
  // Open modal (page is already at /admin)
  // First ensure table is loaded
  await expect(page.locator('table tbody')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('DEMO-COUPLE')).toBeVisible({ timeout: 5000 })

  const tableRows = page.locator('tbody tr')
  const unlinkedRow = tableRows.filter({
    has: page.locator('text=DEMO-COUPLE')
  }).nth(0)
  const linkButton = unlinkedRow.locator('button', { hasText: '🔗' })
  await expect(linkButton).toBeVisible({ timeout: 5000 })
  await linkButton.click({ force: true })

  // Wait for modal
  await expect(page.getByRole('heading', { name: 'Link Guest to Invite' })).toBeVisible()

  // Click cancel
  await page.getByRole('button', { name: 'Cancel' }).click({ force: true })

  // Modal should close
  await expect(page.getByRole('heading', { name: 'Link Guest to Invite' })).not.toBeVisible()
})

test('closes modal when clicking outside (overlay click)', async ({ page }) => {
  // Open modal (page is already at /admin)
  // First ensure table is loaded
  await expect(page.locator('table tbody')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('DEMO-COUPLE')).toBeVisible({ timeout: 5000 })

  const tableRows = page.locator('tbody tr')
  const unlinkedRow = tableRows.filter({
    has: page.locator('text=DEMO-COUPLE')
  }).nth(0)
  const linkButton = unlinkedRow.locator('button', { hasText: '🔗' })
  await expect(linkButton).toBeVisible({ timeout: 5000 })
  await linkButton.click({ force: true })

  // Wait for modal
  const modal = page.getByRole('heading', { name: 'Link Guest to Invite' })
  await expect(modal).toBeVisible()

  // Click overlay (outside the modal)
  const modalOverlay = page.locator('div').filter({
    hasText: 'Link Guest to Invite'
  }).first()

  // Get modal's bounding box
  const bbox = await modalOverlay.boundingBox()
  if (bbox) {
    // Click outside modal but within overlay
    await page.click('body', { position: { x: 10, y: 10 } })
  }

  // Modal should close
  await expect(modal).not.toBeVisible()
})

test('shows delete button for invites', async ({ page }) => {
  const tableRows = page.locator('tbody tr')
  const firstRow = tableRows.nth(0)

  // Look for delete button (🗑️)
  const deleteButton = firstRow.locator('button', { hasText: '🗑️' })
  await expect(deleteButton).toBeVisible()
})

test('deletes an invite after confirmation', async ({ page }) => {
  let confirmCalled = false
  page.on('dialog', async (dialog) => {
    confirmCalled = true
    expect(dialog.message()).toContain('Delete this invite')
    await dialog.accept()
  })

  // Count invites before (page is already at /admin)
  const invitesBeforeText = await page.getByRole('heading', { name: /Invites \(\d+\)/ }).textContent()
  const invitesBefore = parseInt(invitesBeforeText?.match(/\d+/)?.[0] || '0')

  // Delete first invite - find the delete button more specifically
  // Look for the button with delete emoji in the first row
  const firstRowDeleteButton = page.locator('tbody tr').first().locator('button:has-text("🗑️")')

  // Ensure button is visible before clicking
  await expect(firstRowDeleteButton).toBeVisible({ timeout: 5000 })

  // Click the delete button (using force to bypass any overlays)
  await firstRowDeleteButton.click({ force: true, timeout: 5000 })

  // Verify confirmation was called
  expect(confirmCalled).toBe(true)

  // Check success message (with timeout for visibility)
  await expect(page.getByText('Invite deleted')).toBeVisible({ timeout: 5000 })

  // Wait a moment for the table to update
  await page.waitForTimeout(200)

  // Count should decrease
  const invitesAfterText = await page.getByRole('heading', { name: /Invites \(\d+\)/ }).textContent()
  const invitesAfter = parseInt(invitesAfterText?.match(/\d+/)?.[0] || '0')
  expect(invitesAfter).toBe(invitesBefore - 1)
})

test('displays error alert on API failure', async ({ page }) => {
  // Override invites mock to return error
  await page.route(/\/api\/invites(?:\/\d+)?(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      await json(route, { detail: 'Failed to generate invite' }, 500)
    } else {
      await json(route, existingInvites)
    }
  })

  // Try to generate invite (page is already at /admin)
  const generateButton = page.getByRole('button', { name: 'Generate Code' })
  await generateButton.click()

  // Check error message
  await expect(page.getByText(/Failed to generate invite/)).toBeVisible()
})

test('displays success alert when invite is copied', async ({ page }) => {
  // Find copy button and click it (page is already at /admin)
  // First ensure table is loaded
  await expect(page.locator('table tbody')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('DEMO-001')).toBeVisible({ timeout: 5000 })

  const tableRows = page.locator('tbody tr')
  const firstRow = tableRows.nth(0)
  const copyButton = firstRow.locator('button', { hasText: '📋' })
  await expect(copyButton).toBeVisible({ timeout: 5000 })
  await copyButton.click()

  // Success message should appear
  const successAlert = page.getByText(/Copied:/)
  await expect(successAlert).toBeVisible()
})

test('link guest button is disabled when no guests available', async ({ page }) => {
  // Mock no unlinked guests
  await page.route(/\/api\/guests(?:\/\d+)?(?:\?.*)?$/, async (route) => {
    // All guests are linked
    await json(route, [
      { id: 10, name: 'Demo Guest 1', email: 'guest1@example.com' },
      { id: 11, name: 'Demo Guest 2', email: 'guest2@example.com' },
    ])
  })

  // Reload the page to apply the new guest list
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({ timeout: 10000 })

  // Look for link buttons - should not be visible when no unlinked guests (page is already at /admin)
  // First ensure table is loaded
  await expect(page.locator('table tbody')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('DEMO-001')).toBeVisible({ timeout: 5000 })

  const tableRows = page.locator('tbody tr')
  const firstRow = tableRows.nth(0)

  // If no unlinked guests, link button shouldn't appear
  const linkButton = firstRow.locator('button', { hasText: '🔗' })
  // Link button should NOT be visible when all guests are linked
  await expect(linkButton).not.toBeVisible()
})

// Wave 3 item 14 D1: wedding party fields on the invite generate/edit flows.
test.describe('wedding party fields', () => {
  test('generating a guest invite with a party shows it in the table', async ({ page }) => {
    const roleSelect = page.getByLabel('Role')
    await roleSelect.selectOption('guest')

    await page.getByRole('radiogroup', { name: 'Wedding party' }).getByLabel('Stag Do').check()
    await page.getByRole('button', { name: 'Generate Code' }).click()

    await expect(page.getByText(/Invite code generated:/)).toBeVisible()
    await expect(page.getByRole('row', { name: /NEW-/ }).getByText('Stag Do')).toBeVisible()
  })

  test('checking Best Man is allowed alongside one existing holder', async ({ page }) => {
    // Re-mock with DEMO-001 already holding Best Man for stag (1 of the 2
    // allowed slots filled), then reload — mockInvites fully re-registers
    // the route (every method branch returns explicitly), so this is safe
    // unlike a route.fallback() chain.
    await mockInvites(page, [
      { ...existingInvites[0], party: 'stag', party_admin: true, party_title: 'Best Man' },
      existingInvites[1],
      existingInvites[2],
    ])
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
    await expect(page.locator('tbody tr').first()).toBeVisible()

    const roleSelect = page.getByLabel('Role')
    await roleSelect.selectOption('guest')
    await page.getByRole('radiogroup', { name: 'Wedding party' }).getByLabel('Stag Do').check()

    const checkbox = page.getByLabel(/Make this guest a Best Man/)
    await expect(checkbox).toBeEnabled()
    await checkbox.check()
    await expect(page.getByText(/already has 2/)).not.toBeVisible()

    await page.getByRole('button', { name: 'Generate Code' }).click()
    await expect(page.getByText(/Invite code generated:/)).toBeVisible()
  })

  test('Best Man checkbox is disabled once a party already has 2 holders', async ({ page }) => {
    await mockInvites(page, [
      { ...existingInvites[0], party: 'stag', party_admin: true, party_title: 'Best Man' },
      { ...existingInvites[1], role: 'guest', guest_id: 11, party: 'stag', party_admin: true, party_title: 'Best Man' },
      existingInvites[2],
    ])
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
    await expect(page.locator('tbody tr').first()).toBeVisible()

    const roleSelect = page.getByLabel('Role')
    await roleSelect.selectOption('guest')
    await page.getByRole('radiogroup', { name: 'Wedding party' }).getByLabel('Stag Do').check()

    const checkbox = page.getByLabel(/Make this guest a Best Man/)
    await expect(checkbox).toBeDisabled()
    await expect(page.getByText(/already has 2/)).toBeVisible()
  })

  test('generating a couple invite with identity fields shows them in the table', async ({ page }) => {
    const roleSelect = page.getByLabel('Role')
    await roleSelect.selectOption('couple')

    await page.getByLabel('Partner label').fill('Ashley')
    await page.getByLabel('Their own party').selectOption('stag')
    await page.getByRole('button', { name: 'Generate Code' }).click()

    await expect(page.getByText(/Invite code generated:/)).toBeVisible()
    await expect(page.getByRole('row', { name: /NEW-/ }).getByText('Ashley')).toBeVisible()
  })

  test('editing wedding party details via the party editor modal', async ({ page }) => {
    await expect(page.locator('table tbody')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('DEMO-001')).toBeVisible({ timeout: 5000 })

    const demoRow = page.locator('tbody tr', { has: page.locator('text=DEMO-001') })
    await demoRow.locator('button[title="Edit wedding party details"]').click()

    const dialog = page.getByRole('dialog', { name: 'Edit Wedding Party Details' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('radiogroup', { name: 'Wedding party' }).getByLabel('Hen Do').check()
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(dialog).not.toBeVisible()
    await expect(demoRow.getByText('Hen Do')).toBeVisible()
  })
})

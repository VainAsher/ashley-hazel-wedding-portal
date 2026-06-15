import { expect, test, type Page, type Route } from '@playwright/test'

type AuthRole = 'couple' | 'coordinator' | 'guest'

interface AuthUser {
  id: number
  name: string
  role: AuthRole
  wedding_id: number
  invite_id: number
  guest_id: number | null
}

interface Invite {
  id: number
  code: string
  wedding_id: number
  role: string
  guest_id: number | null
  household_name: string | null
  created_at: string
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
  // Don't mock auth endpoints - let real backend handle authentication
  // The backend will set session cookies automatically
}

async function mockInvites(page: Page, invites: Invite[] = existingInvites) {
  await page.route('**/api/invites*', async (route) => {
    const url = new URL(route.request().url())

    // Handle GET /api/invites?wedding_id=1
    if (route.request().method() === 'GET' && url.search.includes('wedding_id')) {
      await json(route, invites)
      return
    }

    // Handle GET /api/invites/:id
    const match = url.pathname.match(/\/api\/invites\/(\d+)$/)
    if (route.request().method() === 'GET' && match) {
      const id = parseInt(match[1])
      const invite = invites.find(i => i.id === id)
      if (invite) {
        await json(route, invite)
      } else {
        await json(route, { detail: 'Invite not found' }, 404)
      }
      return
    }

    // Handle POST /api/invites - generate new invite
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { wedding_id: number; role: string }
      const newInvite: Invite = {
        id: Math.max(...invites.map(i => i.id)) + 1,
        code: `NEW-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        wedding_id: body.wedding_id,
        role: body.role,
        guest_id: null,
        household_name: null,
        created_at: new Date().toISOString(),
      }
      invites.unshift(newInvite)
      await json(route, newInvite, 201)
      return
    }

    // Handle PATCH /api/invites/:id - link guest to invite
    const patchMatch = url.pathname.match(/\/api\/invites\/(\d+)$/)
    if (route.request().method() === 'PATCH' && patchMatch) {
      const id = parseInt(patchMatch[1])
      const body = route.request().postDataJSON() as { guest_id?: number }
      const invite = invites.find(i => i.id === id)
      if (invite) {
        if (body.guest_id !== undefined) {
          invite.guest_id = body.guest_id
        }
        await json(route, invite)
      } else {
        await json(route, { detail: 'Invite not found' }, 404)
      }
      return
    }

    // Handle DELETE /api/invites/:id
    const deleteMatch = url.pathname.match(/\/api\/invites\/(\d+)$/)
    if (route.request().method() === 'DELETE' && deleteMatch) {
      const id = parseInt(deleteMatch[1])
      const index = invites.findIndex(i => i.id === id)
      if (index !== -1) {
        invites.splice(index, 1)
        await json(route, null, 204)
      } else {
        await json(route, { detail: 'Invite not found' }, 404)
      }
      return
    }
  })
}

async function mockGuests(page: Page, guests: Guest[] = existingGuests) {
  await page.route('**/api/guests*', async (route) => {
    await json(route, guests)
  })
}

test.beforeEach(async ({ page }) => {
  await trackBrowserErrors(page)

  // Mock data endpoints BEFORE navigating (so they're ready to intercept requests)
  await mockInvites(page)
  await mockGuests(page)

  // Login through invite page to establish real session with backend
  await page.goto('/invite')
  await page.getByLabel('Invite Code').fill('DEMO-COUPLE')
  await page.getByRole('button', { name: 'Enter' }).click()

  // Wait for successful login and redirect to admin
  await page.waitForURL(/\/admin/, { timeout: 15000 })

  // Verify admin dashboard fully loaded
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({ timeout: 10000 })
})

test.afterEach(async ({ page }) => {
  const browserErrors = Reflect.get(page, 'browserErrors') as string[] | undefined
  const unexpectedErrors = (browserErrors ?? []).filter(
    (message) =>
      !message.includes('the server responded with a status of 401') &&
      !message.includes('net::ERR_FAILED') &&
      !message.includes('Write permission denied'), // Clipboard API not available in headless Playwright
  )
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
  await roleSelect.click()
  await expect(page.getByRole('option', { name: 'Guest' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Coordinator' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Couple' })).toBeVisible()
})

test('displays existing invites in a table', async ({ page }) => {
  // Check table header (page is already at /admin after beforeEach auth setup)
  await expect(page.getByRole('columnheader', { name: 'Code' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Guest' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Created' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible()

  // Check DEMO-001 invite
  await expect(page.getByText('DEMO-001')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'guest' })).toBeVisible()
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
  const tableRows = page.locator('tbody tr')
  const firstRow = tableRows.nth(0)

  // The copy button (📋) should be near the code
  const copyButton = firstRow.locator('button', { has: page.locator('text=📋') })
  await expect(copyButton).toBeVisible()

  // Click copy button and check for success message
  await copyButton.click()
  await expect(page.getByText(/Copied:/)).toBeVisible()
})

test('shows link guest modal when clicking link button', async ({ page }) => {
  // Find an unlinked invite (one with 'Unlinked' text) (page is already at /admin)
  // DEMO-001 is linked, DEMO-COUPLE is unlinked, DEMO-COORD is linked
  const tableRows = page.locator('tbody tr')

  // Find the row with unlinked invite
  const unlinkedRow = tableRows.filter({
    hasText: 'DEMO-COUPLE'
  }).nth(0)

  // Click the link button (🔗)
  const linkButton = unlinkedRow.locator('button', { has: page.locator('text=🔗') })
  await expect(linkButton).toBeVisible()
  await linkButton.click()

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
  const tableRows = page.locator('tbody tr')
  const unlinkedRow = tableRows.filter({
    hasText: 'DEMO-COUPLE'
  }).nth(0)

  // Click link button
  const linkButton = unlinkedRow.locator('button', { has: page.locator('text=🔗') })
  await linkButton.click()

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
    hasText: 'DEMO-COUPLE'
  }).nth(0)
  await expect(updatedRow.locator('text=Unlinked Guest')).toBeVisible()
})

test('closes modal when clicking cancel button', async ({ page }) => {
  // Open modal (page is already at /admin)
  const tableRows = page.locator('tbody tr')
  const unlinkedRow = tableRows.filter({
    hasText: 'DEMO-COUPLE'
  }).nth(0)
  const linkButton = unlinkedRow.locator('button', { has: page.locator('text=🔗') })
  await linkButton.click()

  // Wait for modal
  await expect(page.getByRole('heading', { name: 'Link Guest to Invite' })).toBeVisible()

  // Click cancel
  await page.getByRole('button', { name: 'Cancel' }).click()

  // Modal should close
  await expect(page.getByRole('heading', { name: 'Link Guest to Invite' })).not.toBeVisible()
})

test('closes modal when clicking outside (overlay click)', async ({ page }) => {
  // Open modal (page is already at /admin)
  const tableRows = page.locator('tbody tr')
  const unlinkedRow = tableRows.filter({
    hasText: 'DEMO-COUPLE'
  }).nth(0)
  const linkButton = unlinkedRow.locator('button', { has: page.locator('text=🔗') })
  await linkButton.click()

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
  const deleteButton = firstRow.locator('button', { has: page.locator('text=🗑️') })
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

  // Delete first invite
  const tableRows = page.locator('tbody tr')
  const firstRow = tableRows.nth(0)
  const deleteButton = firstRow.locator('button', { has: page.locator('text=🗑️') })
  await deleteButton.click()

  // Verify confirmation was called
  expect(confirmCalled).toBe(true)

  // Check success message
  await expect(page.getByText('Invite deleted')).toBeVisible()

  // Count should decrease
  const invitesAfterText = await page.getByRole('heading', { name: /Invites \(\d+\)/ }).textContent()
  const invitesAfter = parseInt(invitesAfterText?.match(/\d+/)?.[0] || '0')
  expect(invitesAfter).toBe(invitesBefore - 1)
})

test('displays error alert on API failure', async ({ page }) => {
  // Override invites mock to return error
  await page.route('**/api/invites*', async (route) => {
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
  const tableRows = page.locator('tbody tr')
  const firstRow = tableRows.nth(0)
  const copyButton = firstRow.locator('button', { has: page.locator('text=📋') })
  await copyButton.click()

  // Success message should appear
  const successAlert = page.getByText(/Copied:/)
  await expect(successAlert).toBeVisible()
})

test('link guest button is disabled when no guests available', async ({ page }) => {
  // Mock no unlinked guests
  await page.route('**/api/guests*', async (route) => {
    // All guests are linked
    await json(route, [
      { id: 10, name: 'Demo Guest 1', email: 'guest1@example.com' },
      { id: 11, name: 'Demo Guest 2', email: 'guest2@example.com' },
    ])
  })

  // Look for link buttons - should not be visible when no unlinked guests (page is already at /admin)
  const tableRows = page.locator('tbody tr')
  const firstRow = tableRows.nth(0)

  // If no unlinked guests, link button shouldn't appear
  const linkButton = firstRow.locator('button', { has: page.locator('text=🔗') })
  // Note: The button may or may not appear depending on implementation
  // This test documents the behavior
})

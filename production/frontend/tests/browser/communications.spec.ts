import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

type CommunicationChannel = 'email' | 'whatsapp' | 'sms' | 'announcement'
type CommunicationAudience = 'all' | 'attending' | 'pending' | 'declined'
type CommunicationStatus = 'draft' | 'scheduled' | 'sent'

interface Communication {
  id: number
  wedding_id: number
  subject: string
  body: string | null
  channel: CommunicationChannel
  audience: CommunicationAudience
  status: CommunicationStatus
  scheduled_for: string | null
  sent_at: string | null
  created_at: string | null
  updated_at: string | null
}

const initialCommunication: Communication = {
  id: 4001,
  wedding_id: 1,
  subject: 'Existing Announcement',
  body: 'Save the date everyone!',
  channel: 'email',
  audience: 'all',
  status: 'draft',
  scheduled_for: null,
  sent_at: null,
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

async function installCommunicationsApi(page: Page) {
  let nextId = 5000
  let messages = [{ ...initialCommunication }]

  await page.route(/\/api\/communications(?:\/\d+(?:\/send)?)?$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const sendMatch = url.pathname.match(/\/api\/communications\/(\d+)\/send$/)
    const detailMatch = url.pathname.match(/\/api\/communications\/(\d+)$/)

    if (url.pathname.endsWith('/api/communications') && method === 'GET') {
      await json(route, messages)
      return
    }

    if (url.pathname.endsWith('/api/communications') && method === 'POST') {
      const payload = request.postDataJSON() as Partial<Communication>
      if (payload.subject === 'Duplicate Subject') {
        await json(route, { detail: 'Duplicate subject' }, 400)
        return
      }

      const message: Communication = {
        ...initialCommunication,
        ...payload,
        id: nextId,
        wedding_id: 1,
        created_at: null,
        updated_at: null,
      } as Communication
      nextId += 1
      messages = [...messages, message]
      await json(route, message, 201)
      return
    }

    if (sendMatch && method === 'POST') {
      const messageId = Number(sendMatch[1])
      const existing = messages.find((message) => message.id === messageId)
      if (!existing) {
        await json(route, { detail: 'Message not found' }, 404)
        return
      }
      const updated = {
        ...existing,
        status: 'sent' as CommunicationStatus,
        sent_at: '2026-06-24T10:00:00Z',
      }
      messages = messages.map((message) => (message.id === messageId ? updated : message))
      await json(route, updated)
      return
    }

    if (detailMatch && method === 'PUT') {
      const messageId = Number(detailMatch[1])
      const payload = request.postDataJSON() as Partial<Communication>
      const existing = messages.find((message) => message.id === messageId)
      if (!existing) {
        await json(route, { detail: 'Message not found' }, 404)
        return
      }

      const updated = { ...existing, ...payload, id: messageId, wedding_id: 1 }
      messages = messages.map((message) => (message.id === messageId ? updated : message))
      await json(route, updated)
      return
    }

    if (detailMatch && method === 'DELETE') {
      const messageId = Number(detailMatch[1])
      messages = messages.filter((message) => message.id !== messageId)
      await json(route, { status: 'deleted', id: messageId })
      return
    }

    await json(route, { detail: 'Not found' }, 404)
  })
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)

  // Mock authentication to return a coordinator role user
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

  await installCommunicationsApi(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, ['the server responded with a status of 400'])
  expect(unexpectedErrors).toEqual([])
})

function mainRegion(page: Page) {
  return page.getByRole('main')
}

function formDialog(page: Page) {
  return page.getByRole('dialog')
}

async function openAddForm(page: Page) {
  await page.goto('/admin/communications')
  await mainRegion(page).getByRole('button', { name: 'Add Message' }).click()
  await expect(formDialog(page)).toBeVisible()
  await expect(formDialog(page).getByRole('heading', { name: 'Add Message' })).toBeVisible()
}

async function selectOption(page: Page, triggerLabel: string, optionName: string) {
  await formDialog(page).getByLabel(triggerLabel).click()
  await page.getByRole('option', { name: optionName }).click()
}

async function submitForm(page: Page, buttonName: 'Add Message' | 'Save Message') {
  await formDialog(page).getByRole('button', { name: buttonName }).click()
}

test('renders existing communication count and table columns', async ({ page }) => {
  await page.goto('/admin/communications')

  await expect(mainRegion(page).getByText('1 messages')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Existing Announcement', exact: true })).toBeVisible()
  for (const column of ['Subject', 'Channel', 'Audience', 'Status', 'Actions']) {
    await expect(page.locator('th').filter({ hasText: new RegExp(`^${column}$`) })).toBeVisible()
  }
})

test('opens and cancels the add message form', async ({ page }) => {
  await openAddForm(page)

  await formDialog(page).getByRole('button', { name: 'Cancel' }).click()

  await expect(formDialog(page)).not.toBeVisible()
  await expect(page.getByRole('cell', { name: 'Existing Announcement', exact: true })).toBeVisible()
})

test('validates required subject before submit', async ({ page }) => {
  await openAddForm(page)

  await submitForm(page, 'Add Message')

  await expect(formDialog(page).getByRole('alert')).toHaveText('Subject is required.')
})

test('validates scheduled date for scheduled status', async ({ page }) => {
  await openAddForm(page)
  await formDialog(page).getByLabel('Subject').fill('Reminder')
  await selectOption(page, 'Status', 'Scheduled')

  await submitForm(page, 'Add Message')

  await expect(formDialog(page).getByRole('alert')).toHaveText(
    'Scheduled date is required for scheduled messages.',
  )
})

test('creates a message with channel and audience', async ({ page }) => {
  await openAddForm(page)
  await formDialog(page).getByLabel('Subject').fill('Welcome Message')
  await formDialog(page).getByLabel('Body').fill('Thanks for coming')
  await selectOption(page, 'Channel', 'WhatsApp')
  await selectOption(page, 'Audience', 'Attending')

  await submitForm(page, 'Add Message')

  await expect(page.getByRole('status')).toHaveText('Message created successfully.')
  await expect(page.getByRole('cell', { name: 'Welcome Message', exact: true })).toBeVisible()
  const row = page.getByRole('row', { name: /Welcome Message/ })
  await expect(row.getByText('WhatsApp', { exact: true })).toBeVisible()
  await expect(row.getByRole('cell', { name: 'Attending', exact: true })).toBeVisible()
})

test('cancels edit without saving changes', async ({ page }) => {
  await page.goto('/admin/communications')
  await page.getByRole('button', { name: 'Edit Existing Announcement' }).click()
  await expect(formDialog(page).getByRole('heading', { name: 'Edit Message' })).toBeVisible()

  await formDialog(page).getByLabel('Subject').fill('Changed Subject')
  await formDialog(page).getByRole('button', { name: 'Cancel' }).click()

  await expect(formDialog(page)).not.toBeVisible()
  await expect(page.getByRole('cell', { name: 'Existing Announcement', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Changed Subject', exact: true })).not.toBeVisible()
})

test('edits an existing message', async ({ page }) => {
  await page.goto('/admin/communications')
  await page.getByRole('button', { name: 'Edit Existing Announcement' }).click()
  await expect(formDialog(page).getByRole('heading', { name: 'Edit Message' })).toBeVisible()

  await formDialog(page).getByLabel('Subject').fill('Updated Announcement')
  await selectOption(page, 'Audience', 'Pending')
  await submitForm(page, 'Save Message')

  await expect(page.getByRole('status')).toHaveText('Message updated successfully.')
  await expect(page.getByRole('cell', { name: 'Updated Announcement', exact: true })).toBeVisible()
  const row = page.getByRole('row', { name: /Updated Announcement/ })
  await expect(row.getByRole('cell', { name: 'Pending', exact: true })).toBeVisible()
})

test('dismisses delete confirmation and keeps message visible', async ({ page }) => {
  await page.goto('/admin/communications')

  await page.getByRole('button', { name: 'Delete Existing Announcement' }).click()
  const dialog = formDialog(page)
  await expect(dialog.getByText('Delete Existing Announcement?')).toBeVisible()

  await dialog.getByRole('button', { name: 'Cancel' }).click()

  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('cell', { name: 'Existing Announcement', exact: true })).toBeVisible()
  await expect(page.getByRole('status')).not.toBeVisible()
})

test('shows empty state after deleting the only message', async ({ page }) => {
  await page.goto('/admin/communications')

  await page.getByRole('button', { name: 'Delete Existing Announcement' }).click()
  await formDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText('Message deleted successfully.')
  await expect(mainRegion(page).getByText('No messages found.')).toBeVisible()
  await expect(mainRegion(page).getByText('0 messages')).toBeVisible()
})

test('sends a draft message to member dashboards', async ({ page }) => {
  await page.goto('/admin/communications')

  const row = page.getByRole('row', { name: /Existing Announcement/ })
  await expect(row.getByText('Draft', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Send Existing Announcement' }).click()

  await expect(page.getByRole('status')).toHaveText(
    'Message sent — delivered to member dashboards in-app.',
  )
  await expect(row.getByText('Sent', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Send Existing Announcement' }),
  ).not.toBeVisible()
})

test('filters messages by status', async ({ page }) => {
  await page.goto('/admin/communications')
  await expect(page.getByRole('cell', { name: 'Existing Announcement', exact: true })).toBeVisible()

  // Filter to 'sent' - the draft message should disappear
  await mainRegion(page).getByLabel('Filter by status').click()
  await page.getByRole('option', { name: 'Sent' }).click()

  await expect(page.getByRole('cell', { name: 'Existing Announcement', exact: true })).not.toBeVisible()
  await expect(mainRegion(page).getByText('No messages found.')).toBeVisible()

  // Back to all
  await mainRegion(page).getByLabel('Filter by status').click()
  await page.getByRole('option', { name: 'All statuses' }).click()
  await expect(page.getByRole('cell', { name: 'Existing Announcement', exact: true })).toBeVisible()
})

test('completes add, edit, mark-sent, and delete flow', async ({ page }) => {
  await page.goto('/admin/communications')
  await expect(mainRegion(page).getByRole('heading', { name: 'Messages', exact: true })).toBeVisible()

  // Add
  await mainRegion(page).getByRole('button', { name: 'Add Message' }).click()
  await formDialog(page).getByLabel('Subject').fill('E2E Notice')
  await selectOption(page, 'Channel', 'SMS')
  await submitForm(page, 'Add Message')
  await expect(page.getByRole('status')).toHaveText('Message created successfully.')
  await expect(page.getByRole('cell', { name: 'E2E Notice', exact: true })).toBeVisible()

  // Edit
  await page.getByRole('button', { name: 'Edit E2E Notice' }).click()
  await expect(formDialog(page).getByRole('heading', { name: 'Edit Message' })).toBeVisible()
  await selectOption(page, 'Audience', 'Declined')
  await submitForm(page, 'Save Message')
  await expect(page.getByRole('status')).toHaveText('Message updated successfully.')
  const row = page.getByRole('row', { name: /E2E Notice/ })
  await expect(row.getByRole('cell', { name: 'Declined', exact: true })).toBeVisible()

  // Send
  await page.getByRole('button', { name: 'Send E2E Notice' }).click()
  await expect(page.getByRole('status')).toHaveText(
    'Message sent — delivered to member dashboards in-app.',
  )
  await expect(row.getByText('Sent', { exact: true })).toBeVisible()

  // Delete
  await page.getByRole('button', { name: 'Delete E2E Notice' }).click()
  await expect(formDialog(page).getByText('Delete E2E Notice?')).toBeVisible()
  await formDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Message deleted successfully.')
  await expect(page.getByRole('cell', { name: 'E2E Notice', exact: true })).not.toBeVisible()
})

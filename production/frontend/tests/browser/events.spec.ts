import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

interface WeddingEvent {
  id: number
  wedding_id: number
  event_name: string
  event_date: string | null
  event_time: string | null
  location: string | null
  description: string | null
  created_at: string | null
}

const initialEvents: WeddingEvent[] = [
  {
    id: 8001,
    wedding_id: 1,
    event_name: 'Reception',
    event_date: '2026-08-20',
    event_time: '18:00',
    location: 'Grand Hall',
    description: null,
    created_at: null,
  },
  {
    id: 8002,
    wedding_id: 1,
    event_name: 'Ceremony',
    event_date: '2026-08-20',
    event_time: '15:00',
    location: 'Garden',
    description: null,
    created_at: null,
  },
]

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status })
}

async function installEventsApi(page: Page) {
  let nextId = 9000
  let events = initialEvents.map((event) => ({ ...event }))

  await page.route(/\/api\/events(?:\/\d+)?$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const detailMatch = url.pathname.match(/\/api\/events\/(\d+)$/)

    if (url.pathname.endsWith('/api/events') && method === 'GET') {
      await json(route, events)
      return
    }

    if (url.pathname.endsWith('/api/events') && method === 'POST') {
      const payload = request.postDataJSON() as Partial<WeddingEvent>
      const event: WeddingEvent = {
        id: nextId,
        wedding_id: 1,
        event_name: '',
        event_date: null,
        event_time: null,
        location: null,
        description: null,
        ...payload,
        created_at: null,
      } as WeddingEvent
      nextId += 1
      events = [...events, event]
      await json(route, event, 201)
      return
    }

    if (detailMatch && method === 'PUT') {
      const eventId = Number(detailMatch[1])
      const payload = request.postDataJSON() as Partial<WeddingEvent>
      const existing = events.find((e) => e.id === eventId)
      if (!existing) {
        await json(route, { detail: 'Event not found' }, 404)
        return
      }
      const updated = { ...existing, ...payload, id: eventId }
      events = events.map((e) => (e.id === eventId ? updated : e))
      await json(route, updated)
      return
    }

    if (detailMatch && method === 'DELETE') {
      const eventId = Number(detailMatch[1])
      events = events.filter((e) => e.id !== eventId)
      await json(route, { status: 'deleted', id: eventId })
      return
    }

    await json(route, { detail: 'Not found' }, 404)
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

  await installEventsApi(page)
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

test('renders event count, table columns, and date-sorted order', async ({ page }) => {
  await page.goto('/admin/events')

  await expect(mainRegion(page).getByText('2 events')).toBeVisible()
  for (const column of ['Event Name', 'Date', 'Time', 'Location', 'Actions']) {
    await expect(page.locator('th').filter({ hasText: new RegExp(`^${column}$`) })).toBeVisible()
  }

  // Ceremony (15:00) should sort before Reception (18:00) on the same date.
  const rows = page.getByRole('row')
  const ceremonyIndex = (await rows.allInnerTexts()).findIndex((t) => t.includes('Ceremony'))
  const receptionIndex = (await rows.allInnerTexts()).findIndex((t) => t.includes('Reception'))
  expect(ceremonyIndex).toBeLessThan(receptionIndex)
})

test('validates required event name before submit', async ({ page }) => {
  await page.goto('/admin/events')
  await mainRegion(page).getByRole('button', { name: 'Add Event' }).click()
  await expect(formDialog(page)).toBeVisible()

  await formDialog(page).getByRole('button', { name: 'Add Event' }).click()

  await expect(formDialog(page).getByRole('alert')).toHaveText('Event name is required.')
})

test('adds an event with date, time, and location', async ({ page }) => {
  await page.goto('/admin/events')
  await mainRegion(page).getByRole('button', { name: 'Add Event' }).click()

  await formDialog(page).getByLabel('Event Name').fill('Rehearsal Dinner')
  await formDialog(page).getByLabel('Date').fill('2026-08-19')
  await formDialog(page).getByLabel('Time').fill('19:30')
  await formDialog(page).getByLabel('Location').fill('The Bistro')

  await formDialog(page).getByRole('button', { name: 'Add Event' }).click()

  await expect(page.getByRole('status')).toHaveText('Event added successfully.')
  await expect(page.getByRole('cell', { name: 'Rehearsal Dinner', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'The Bistro', exact: true })).toBeVisible()
})

test('edits an event location', async ({ page }) => {
  await page.goto('/admin/events')
  await page.getByRole('button', { name: 'Edit Ceremony' }).click()
  await expect(formDialog(page).getByRole('heading', { name: 'Edit Event' })).toBeVisible()

  await formDialog(page).getByLabel('Location').fill('Rose Garden')
  await formDialog(page).getByRole('button', { name: 'Save Event' }).click()

  await expect(page.getByRole('status')).toHaveText('Event updated successfully.')
  await expect(page.getByRole('cell', { name: 'Rose Garden', exact: true })).toBeVisible()
})

test('deletes an event and removes it from the table', async ({ page }) => {
  await page.goto('/admin/events')

  await page.getByRole('button', { name: 'Delete Reception' }).click()
  await expect(formDialog(page).getByText('Delete Reception?')).toBeVisible()
  await formDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(page.getByRole('status')).toHaveText('Event deleted successfully.')
  await expect(page.getByRole('cell', { name: 'Reception', exact: true })).not.toBeVisible()
  await expect(mainRegion(page).getByText('1 events')).toBeVisible()
})

import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

interface NotificationItem {
  id: number
  wedding_id: number
  kind: 'communication' | 'mention' | 'system'
  title: string
  body: string | null
  link_path: string | null
  created_at: string | null
  read_at: string | null
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

function seedNotifications(): NotificationItem[] {
  const now = Date.now()
  const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString()
  return [
    {
      id: 301,
      wedding_id: 1,
      kind: 'communication',
      title: 'Menu tasting update',
      body: 'The caterer confirmed the tasting date — details on the schedule page.',
      link_path: '/dashboard',
      created_at: iso(5),
      read_at: null,
    },
    {
      id: 302,
      wedding_id: 1,
      kind: 'communication',
      title: 'Shuttle times announced',
      body: 'Shuttles leave the hotel at 1pm sharp.',
      link_path: '/dashboard',
      created_at: iso(90),
      read_at: null,
    },
    {
      id: 303,
      wedding_id: 1,
      kind: 'system',
      title: 'Welcome to the portal',
      body: null,
      link_path: '/dashboard',
      created_at: iso(60 * 24 * 2),
      read_at: iso(60 * 24),
    },
  ]
}

interface NotificationsApiState {
  items: NotificationItem[]
  readPosts: number[]
  readAllPosts: number
}

async function installNotificationsApi(
  page: Page,
  items: NotificationItem[],
): Promise<NotificationsApiState> {
  const state: NotificationsApiState = { items, readPosts: [], readAllPosts: 0 }

  await page.route(/\/api\/notifications(?:\/(?:\d+\/read|read-all))?$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const readMatch = url.pathname.match(/\/api\/notifications\/(\d+)\/read$/)

    if (url.pathname.endsWith('/api/notifications') && method === 'GET') {
      await json(route, {
        items: state.items,
        unread_count: state.items.filter((item) => !item.read_at).length,
      })
      return
    }

    if (url.pathname.endsWith('/api/notifications/read-all') && method === 'POST') {
      const updated = state.items.filter((item) => !item.read_at).length
      state.readAllPosts += 1
      state.items = state.items.map((item) => ({
        ...item,
        read_at: item.read_at ?? new Date().toISOString(),
      }))
      await json(route, { updated })
      return
    }

    if (readMatch && method === 'POST') {
      const id = Number(readMatch[1])
      const existing = state.items.find((item) => item.id === id)
      if (!existing) {
        await json(route, { detail: 'Notification not found' }, 404)
        return
      }
      state.readPosts.push(id)
      const updated = { ...existing, read_at: existing.read_at ?? new Date().toISOString() }
      state.items = state.items.map((item) => (item.id === id ? updated : item))
      await json(route, updated)
      return
    }

    await json(route, { detail: 'Not found' }, 404)
  })

  return state
}

async function installGuestAuth(page: Page) {
  await page.route('**/api/auth/me', async (route) => {
    await json(route, {
      id: 9,
      name: 'Wedding Guest',
      role: 'guest',
      wedding_id: 1,
      invite_id: 3,
      guest_id: 42,
      wedding_phase: 'live',
    })
  })
}

async function installGuestDashboardApis(page: Page) {
  await installGuestAuth(page)
  await page.route('**/api/portal/wedding', async (route) => {
    await json(route, {
      couple_names: 'Ashley & Hazel',
      wedding_date: '2027-06-19',
      ceremony_time: '14:00',
      ceremony_location: 'The Arches, Dean Clough',
      reception_location: 'The Arches, Dean Clough',
      phase: 'live',
    })
  })
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  expect(filterIgnorableErrors(browserErrors)).toEqual([])
})

test('bell badge shows the unread count in the guest header', async ({ page }) => {
  await installGuestDashboardApis(page)
  await installNotificationsApi(page, seedNotifications())

  await page.goto('/dashboard')

  const bell = page.getByRole('button', { name: 'Notifications (2 unread)' })
  await expect(bell).toBeVisible()
  await expect(page.getByTestId('notifications-badge')).toHaveText('2')
})

test('bell popover lists recent notifications and mark-all-read fires the POST', async ({
  page,
}) => {
  await installGuestDashboardApis(page)
  const state = await installNotificationsApi(page, seedNotifications())

  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Notifications (2 unread)' }).click()

  const popover = page.getByRole('dialog', { name: 'Notifications' })
  await expect(popover).toBeVisible()
  await expect(popover.getByText('Menu tasting update')).toBeVisible()
  await expect(popover.getByText('Shuttles leave the hotel at 1pm sharp.')).toBeVisible()
  await expect(popover.getByText(/ago|just now/).first()).toBeVisible()

  await popover.getByRole('button', { name: 'Mark all read' }).click()

  await expect(page.getByTestId('notifications-badge')).not.toBeVisible()
  expect(state.readAllPosts).toBe(1)
})

test('dashboard Messages card shows recent notifications and marks one read on click', async ({
  page,
}) => {
  await installGuestDashboardApis(page)
  const state = await installNotificationsApi(page, seedNotifications())

  await page.goto('/dashboard')

  const main = page.getByRole('main')
  await expect(main.getByText('Messages', { exact: true })).toBeVisible()
  await expect(main.getByText('Menu tasting update')).toBeVisible()
  await expect(main.getByText('Shuttle times announced')).toBeVisible()
  await expect(main.getByText('Welcome to the portal')).toBeVisible()

  // Unread items carry a dot; clicking one marks it read.
  await expect(page.getByTestId('unread-dot')).toHaveCount(2)
  await page.getByRole('button', { name: 'Mark Menu tasting update read' }).click()

  await expect(page.getByTestId('unread-dot')).toHaveCount(1)
  expect(state.readPosts).toEqual([301])
})

test('dashboard hides the Messages card when there are no notifications', async ({ page }) => {
  await installGuestDashboardApis(page)
  await installNotificationsApi(page, [])

  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { name: 'Welcome, Wedding' })).toBeVisible()
  await expect(page.getByRole('main').getByText('Messages', { exact: true })).not.toBeVisible()
})

test('bell badge shows the unread count in the admin header', async ({ page }) => {
  await page.route('**/api/auth/me', async (route) => {
    await json(route, {
      id: 1,
      name: 'Test Coordinator',
      role: 'coordinator',
      wedding_id: 1,
      invite_id: 1,
      guest_id: null,
      wedding_phase: 'live',
    })
  })
  await page.route('**/api/communications', async (route) => {
    await json(route, [])
  })
  await installNotificationsApi(page, seedNotifications())

  await page.goto('/admin/communications')

  await expect(page.getByRole('button', { name: 'Notifications (2 unread)' })).toBeVisible()
  await expect(page.getByTestId('notifications-badge')).toHaveText('2')

  // The popover works in the admin header too.
  await page.getByRole('button', { name: 'Notifications (2 unread)' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Notifications' }).getByText('Menu tasting update'),
  ).toBeVisible()
})

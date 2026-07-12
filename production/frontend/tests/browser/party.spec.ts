import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

interface PartyAccess {
  stag: boolean
  hen: boolean
}

interface PartyMember {
  invite_id: number
  name: string
  party_admin: boolean
  party_title: string | null
}

interface PartyMessage {
  id: number
  author_name: string
  author_invite_id: number
  message: string
  hidden: boolean
  pinned: boolean
  created_at: string
}

interface PartySummary {
  party: 'stag' | 'hen'
  is_party_admin: boolean
  info: { details: string | null; updated_at: string | null }
  members: PartyMember[]
  messages: PartyMessage[]
  reveal_banner: { subject_invite_id: number; subject_name: string; revealed: boolean } | null
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status })
}

function baseSummary(overrides: Partial<PartySummary> = {}): PartySummary {
  return {
    party: 'stag',
    is_party_admin: false,
    info: { details: 'Halifax, Saturday night — details TBC.', updated_at: '2026-06-01T10:00:00Z' },
    members: [
      { invite_id: 101, name: 'Best Man Ben', party_admin: true, party_title: 'Best Man' },
      { invite_id: 102, name: 'Plain Guest Pete', party_admin: false, party_title: null },
    ],
    messages: [
      {
        id: 1,
        author_name: 'Best Man Ben',
        author_invite_id: 101,
        message: 'Who is in for paintball?',
        hidden: false,
        pinned: true,
        created_at: '2026-06-10T10:00:00Z',
      },
      {
        id: 2,
        author_name: 'Plain Guest Pete',
        author_invite_id: 102,
        message: 'Count me in!',
        hidden: false,
        pinned: false,
        created_at: '2026-06-11T10:00:00Z',
      },
    ],
    reveal_banner: null,
    ...overrides,
  }
}

async function installPartyApi(
  page: Page,
  access: PartyAccess,
  summaries: Partial<Record<'stag' | 'hen', PartySummary>>,
) {
  await page.route('**/api/party/access', async (route) => {
    await json(route, access)
  })

  await page.route(/\/api\/party\/(stag|hen)\/summary$/, async (route) => {
    const match = route.request().url().match(/\/api\/party\/(stag|hen)\/summary$/)
    const party = match?.[1] as 'stag' | 'hen'
    const summary = summaries[party]
    if (!summary) {
      await json(route, { detail: 'Not authorized' }, 403)
      return
    }
    await json(route, summary)
  })

  await page.route(/\/api\/party\/(stag|hen)\/messages$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }
    const match = route.request().url().match(/\/api\/party\/(stag|hen)\/messages$/)
    const party = match?.[1] as 'stag' | 'hen'
    const summary = summaries[party]
    if (!summary) {
      await json(route, { detail: 'Not authorized' }, 403)
      return
    }
    const body = route.request().postDataJSON() as { message: string }
    const newMessage: PartyMessage = {
      id: summary.messages.length + 100,
      author_name: 'You',
      author_invite_id: 999,
      message: body.message,
      hidden: false,
      pinned: false,
      created_at: new Date().toISOString(),
    }
    summary.messages = [newMessage, ...summary.messages]
    await json(route, newMessage, 201)
  })

  await page.route(/\/api\/party\/(stag|hen)\/messages\/\d+$/, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue()
      return
    }
    const match = route.request().url().match(/\/api\/party\/(stag|hen)\/messages\/(\d+)$/)
    const party = match?.[1] as 'stag' | 'hen'
    const messageId = Number(match?.[2])
    const summary = summaries[party]
    const target = summary?.messages.find((m) => m.id === messageId)
    if (!summary || !target) {
      await json(route, { detail: 'Not found' }, 404)
      return
    }
    const patch = route.request().postDataJSON() as { hidden?: boolean; pinned?: boolean }
    Object.assign(target, patch)
    await json(route, target)
  })

  await page.route(/\/api\/party\/(stag|hen)\/reveal$/, async (route) => {
    const match = route.request().url().match(/\/api\/party\/(stag|hen)\/reveal$/)
    const party = match?.[1] as 'stag' | 'hen'
    const summary = summaries[party]
    if (!summary || !summary.reveal_banner) {
      await json(route, { detail: 'Not authorized' }, 403)
      return
    }
    const body = route.request().postDataJSON() as { invite_id: number; revealed: boolean }
    summary.reveal_banner = { ...summary.reveal_banner, revealed: body.revealed }
    await json(route, { party, invite_id: body.invite_id, revealed: body.revealed })
  })

  await page.route(/\/api\/party\/(stag|hen)\/info$/, async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue()
      return
    }
    const match = route.request().url().match(/\/api\/party\/(stag|hen)\/info$/)
    const party = match?.[1] as 'stag' | 'hen'
    const summary = summaries[party]
    if (!summary) {
      await json(route, { detail: 'Not authorized' }, 403)
      return
    }
    const body = route.request().postDataJSON() as { details: string | null }
    summary.info = { details: body.details, updated_at: new Date().toISOString() }
    await json(route, summary.info)
  })
}

async function mockGuestAuth(page: Page) {
  await page.route('**/api/auth/me', async (route) => {
    await json(route, {
      id: 5,
      name: 'Plain Guest Pete',
      role: 'guest',
      wedding_id: 1,
      invite_id: 102,
      guest_id: 5,
      wedding_phase: 'live',
    })
  })
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  // A 403 from /api/party/*/summary is the expected, correct response for
  // the "denied" test below — not a bug to fail the suite over.
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [
    'the server responded with a status of 403',
  ])
  expect(unexpectedErrors).toEqual([])
})

function mainRegion(page: Page) {
  return page.getByRole('main')
}

test.describe('nav visibility', () => {
  test('nav shows only the parties the guest has access to', async ({ page }) => {
    await mockGuestAuth(page)
    await installPartyApi(page, { stag: true, hen: false }, { stag: baseSummary() })
    await page.goto('/dashboard')

    await expect(page.getByRole('link', { name: 'Stag Do' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Hen Do' })).toHaveCount(0)
  })

  test('nav hides both when access is false for both', async ({ page }) => {
    await mockGuestAuth(page)
    await installPartyApi(page, { stag: false, hen: false }, {})
    await page.goto('/dashboard')

    await expect(page.getByRole('link', { name: 'Stag Do' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Hen Do' })).toHaveCount(0)
  })
})

test.describe('party page', () => {
  test('renders details, members and messages', async ({ page }) => {
    await mockGuestAuth(page)
    await installPartyApi(page, { stag: true, hen: false }, { stag: baseSummary() })
    await page.goto('/party/stag')

    const main = mainRegion(page)
    await expect(main.getByRole('heading', { name: 'Stag Do', exact: true })).toBeVisible()
    await expect(main.getByText('Halifax, Saturday night')).toBeVisible()
    await expect(main.getByRole('list').getByText('Best Man Ben', { exact: true })).toBeVisible()
    await expect(main.getByRole('list').getByText('Plain Guest Pete', { exact: true })).toBeVisible()
    await expect(main.getByText('Who is in for paintball?')).toBeVisible()
    await expect(main.getByText('Count me in!')).toBeVisible()
  })

  test('a non-member is denied and sees an error, not the content', async ({ page }) => {
    await mockGuestAuth(page)
    await installPartyApi(page, { stag: false, hen: false }, {})
    await page.goto('/party/stag')

    await expect(mainRegion(page).getByRole('alert')).toBeVisible()
    await expect(page.getByText('Who is in for paintball?')).toHaveCount(0)
  })

  test('a member can post a new message', async ({ page }) => {
    await mockGuestAuth(page)
    await installPartyApi(page, { stag: true, hen: false }, { stag: baseSummary() })
    await page.goto('/party/stag')

    const main = mainRegion(page)
    await main.locator('#party-message-textarea').fill('See you all there!')
    await main.getByRole('button', { name: 'Post message' }).click()

    await expect(main.getByText('See you all there!')).toBeVisible()
  })
})

test.describe('reveal banner', () => {
  test('shows for the non-subject partner with current access, and toggles', async ({ page }) => {
    await page.route('**/api/auth/me', async (route) => {
      await json(route, {
        id: 30,
        name: 'Hazel',
        role: 'couple',
        wedding_id: 1,
        invite_id: 40,
        guest_id: null,
        wedding_phase: 'live',
      })
    })
    await installPartyApi(
      page,
      { stag: true, hen: false },
      {
        stag: baseSummary({
          reveal_banner: { subject_invite_id: 41, subject_name: 'Ashley', revealed: false },
        }),
      },
    )
    await page.goto('/party/stag')

    const main = mainRegion(page)
    await expect(main.getByText("Ashley hasn't seen this yet")).toBeVisible()

    await main.getByRole('button', { name: 'Reveal it to them' }).click()
    await expect(main.getByText('Ashley can now see this Stag Do.')).toBeVisible()
    await expect(main.getByRole('button', { name: 'Hide again' })).toBeVisible()
  })

  test('does not show for a guest (only for the non-subject couple member)', async ({ page }) => {
    await mockGuestAuth(page)
    await installPartyApi(page, { stag: true, hen: false }, { stag: baseSummary() })
    await page.goto('/party/stag')

    await expect(mainRegion(page).getByText(/hasn't seen this yet/)).toHaveCount(0)
  })
})

test.describe('party-admin moderation', () => {
  test('party admin can pin and hide a message', async ({ page }) => {
    await page.route('**/api/auth/me', async (route) => {
      await json(route, {
        id: 6,
        name: 'Best Man Ben',
        role: 'guest',
        wedding_id: 1,
        invite_id: 101,
        guest_id: 6,
        wedding_phase: 'live',
      })
    })
    await installPartyApi(
      page,
      { stag: true, hen: false },
      { stag: baseSummary({ is_party_admin: true }) },
    )
    await page.goto('/party/stag')

    const main = mainRegion(page)
    await main.getByRole('button', { name: 'Unpin message from Best Man Ben' }).click()
    await expect(main.getByRole('button', { name: 'Pin message from Best Man Ben' })).toBeVisible()

    await main.getByRole('button', { name: 'Hide message from Plain Guest Pete' }).click()
    await expect(
      main.getByRole('button', { name: 'Unhide message from Plain Guest Pete' }),
    ).toBeVisible()
  })

  test('a non-admin member does not see pin/hide controls', async ({ page }) => {
    await mockGuestAuth(page)
    await installPartyApi(page, { stag: true, hen: false }, { stag: baseSummary() })
    await page.goto('/party/stag')

    await expect(
      mainRegion(page).getByRole('button', { name: /Pin message/ }),
    ).toHaveCount(0)
  })
})

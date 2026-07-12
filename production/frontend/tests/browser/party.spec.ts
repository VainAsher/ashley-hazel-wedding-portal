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

interface MentionEntry {
  invite_id: number
  display_name: string
}

interface PartyTask {
  id: number
  wedding_id: number
  title: string
  description: string | null
  status: 'not_started' | 'in_progress' | 'done' | 'blocked'
  priority: 'low' | 'medium' | 'high'
  context: 'stag' | 'hen'
  position: number | null
  due_date: string | null
  assigned_to: string | null
  category: string | null
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status })
}

/**
 * Wave 3 item 14 D2: the planning board mounted on the party page talks to
 * the same `/api/tasks` surface as the admin Timeline (tests/browser/
 * timeline.spec.ts), just filtered by `?context=stag|hen`. This mock keeps
 * each party's tasks in a separate bucket so the cross-party isolation test
 * below has something real to assert against — a stray leak here would be
 * the same class of bug Kanban V2/D1 tests exhaustively for elsewhere.
 */
function installPartyTaskApi(page: Page, initial: Partial<Record<'stag' | 'hen', PartyTask[]>> = {}) {
  let nextId = 9000
  const tasksByContext: Record<'stag' | 'hen', PartyTask[]> = {
    stag: initial.stag ? [...initial.stag] : [],
    hen: initial.hen ? [...initial.hen] : [],
  }

  return page.route(/\/api\/tasks(?:\/\d+(?:\/move)?)?(?:\?.*)?$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const moveMatch = url.pathname.match(/\/api\/tasks\/(\d+)\/move$/)
    const detailMatch = !moveMatch && url.pathname.match(/\/api\/tasks\/(\d+)$/)

    const findContext = (taskId: number): 'stag' | 'hen' | null => {
      if (tasksByContext.stag.some((t) => t.id === taskId)) return 'stag'
      if (tasksByContext.hen.some((t) => t.id === taskId)) return 'hen'
      return null
    }

    if (url.pathname.endsWith('/api/tasks') && method === 'GET') {
      const context = (url.searchParams.get('context') as 'stag' | 'hen' | null) ?? 'stag'
      await json(route, tasksByContext[context] ?? [])
      return
    }

    if (url.pathname.endsWith('/api/tasks') && method === 'POST') {
      const payload = request.postDataJSON() as Partial<PartyTask>
      const context = (payload.context as 'stag' | 'hen') ?? 'stag'
      const task: PartyTask = {
        id: nextId,
        wedding_id: 1,
        title: payload.title ?? 'Untitled',
        description: payload.description ?? null,
        status: payload.status ?? 'not_started',
        priority: payload.priority ?? 'medium',
        context,
        position: tasksByContext[context].length,
        due_date: payload.due_date ?? null,
        assigned_to: payload.assigned_to ?? null,
        category: null,
      }
      nextId += 1
      tasksByContext[context] = [...tasksByContext[context], task]
      await json(route, task, 201)
      return
    }

    if (moveMatch) {
      const taskId = Number(moveMatch[1])
      const context = findContext(taskId)
      if (!context) {
        await json(route, { detail: 'Task not found' }, 404)
        return
      }
      const payload = request.postDataJSON() as { status: PartyTask['status']; position: number }
      tasksByContext[context] = tasksByContext[context].map((task) =>
        task.id === taskId ? { ...task, status: payload.status, position: payload.position } : task,
      )
      const updated = tasksByContext[context].find((task) => task.id === taskId)
      await json(route, updated)
      return
    }

    if (detailMatch && method === 'PATCH') {
      const taskId = Number(detailMatch[1])
      const context = findContext(taskId)
      if (!context) {
        await json(route, { detail: 'Task not found' }, 404)
        return
      }
      const payload = request.postDataJSON() as Partial<PartyTask>
      tasksByContext[context] = tasksByContext[context].map((task) =>
        task.id === taskId ? { ...task, ...payload, id: taskId } : task,
      )
      const updated = tasksByContext[context].find((task) => task.id === taskId)
      await json(route, updated)
      return
    }

    if (detailMatch && method === 'DELETE') {
      const taskId = Number(detailMatch[1])
      const context = findContext(taskId)
      if (context) {
        tasksByContext[context] = tasksByContext[context].filter((task) => task.id !== taskId)
      }
      await json(route, { status: 'deleted', id: taskId })
      return
    }

    await json(route, { detail: 'Not found' }, 404)
  })
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
  profileEntries: ProfileDirectoryEntry[] = [],
  // @mentions (Wave 3 item 16): the message board's party-scoped directory,
  // keyed by party -- default empty so existing tests (which don't care
  // about mentions) see no autocomplete suggestions.
  mentionDirectories: Partial<Record<'stag' | 'hen', MentionEntry[]>> = {},
) {
  await page.route('**/api/party/access', async (route) => {
    await json(route, access)
  })

  await page.route('**/api/mentions/directory*', async (route) => {
    const url = new URL(route.request().url())
    const scope = url.searchParams.get('scope')
    const entries =
      scope === 'stag' || scope === 'hen' ? mentionDirectories[scope] ?? [] : []
    await json(route, entries)
  })

  // Wave 3 item 14 D3: the party page's "Meet the ... crew" section reads
  // the same GET /api/profiles the public directory uses (item 15), filtered
  // client-side to this party. Default empty so existing tests (which don't
  // care about profiles) see the section quietly absent, per its own render
  // rule (see PartyProfiles's early-return on an empty filtered list).
  await page.route('**/api/profiles', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    await json(route, profileEntries)
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

  test('shows profile cards for this party only (Wave 3 item 14 D3)', async ({ page }) => {
    await mockGuestAuth(page)
    await installPartyApi(
      page,
      { stag: true, hen: false },
      { stag: baseSummary() },
      [
        {
          invite_id: 101,
          party: 'stag',
          display_name: 'Best Man Ben',
          role_title: 'Best Man',
          about: null,
          best_known_for: 'Terrible karaoke',
          favourite_song: null,
          photo_path: null,
          photo_url: null,
          has_profile: true,
        },
        {
          invite_id: 201,
          party: 'hen',
          display_name: 'Maid of Honour Maya',
          role_title: 'Maid of Honour',
          about: null,
          best_known_for: 'Excellent playlists',
          favourite_song: null,
          photo_path: null,
          photo_url: null,
          has_profile: true,
        },
      ],
    )
    await page.goto('/party/stag')

    const main = mainRegion(page)
    await expect(main.getByRole('heading', { name: 'Meet the Stag Do crew' })).toBeVisible()
    // The profile card renders the name as a heading (Ben also appears as a
    // plain list item in MembersCard above — scope to the heading to avoid
    // a strict-mode ambiguity between the two, legitimately-duplicate spots).
    await expect(main.getByRole('heading', { name: 'Best Man Ben', exact: true })).toBeVisible()
    await expect(main.getByText('Terrible karaoke')).toBeVisible()
    // The hen party's profile must never leak onto the stag page.
    await expect(main.getByText('Maid of Honour Maya')).toHaveCount(0)
  })

  test('profile section is quietly absent when no one has a profile yet', async ({ page }) => {
    await mockGuestAuth(page)
    await installPartyApi(page, { stag: true, hen: false }, { stag: baseSummary() }, [])
    await page.goto('/party/stag')

    await expect(mainRegion(page).getByText('Meet the Stag Do crew')).toHaveCount(0)
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

  // -------------------------------------------------------------------------
  // @mentions (Wave 3 item 16): party-scoped -- the composer only offers
  // this party's own members, never the other party's roster.
  // -------------------------------------------------------------------------

  test('message composer autocomplete is scoped to this party only', async ({ page }) => {
    await mockGuestAuth(page)
    await installPartyApi(
      page,
      { stag: true, hen: false },
      { stag: baseSummary() },
      [],
      { stag: [{ invite_id: 401, display_name: 'Best Man Ben' }] },
    )
    await page.goto('/party/stag')

    const main = mainRegion(page)
    await main.locator('#party-message-textarea').fill('Cheers @Best')

    await expect(page.getByRole('option', { name: 'Best Man Ben' })).toBeVisible()
    await page.getByRole('option', { name: 'Best Man Ben' }).click()
    await expect(main.locator('#party-message-textarea')).toHaveValue('Cheers @Best Man Ben ')
  })

  test('renders a highlighted mention on the message board', async ({ page }) => {
    await mockGuestAuth(page)
    await installPartyApi(
      page,
      { stag: true, hen: false },
      {
        stag: baseSummary({
          messages: [
            {
              id: 1,
              author_name: 'Plain Guest Pete',
              author_invite_id: 102,
              message: 'Cheers @Best Man Ben, legendary night!',
              hidden: false,
              pinned: false,
              created_at: '2026-06-10T10:00:00Z',
            },
          ],
        }),
      },
      [],
      { stag: [{ invite_id: 101, display_name: 'Best Man Ben' }] },
    )
    await page.goto('/party/stag')

    const highlighted = mainRegion(page).locator('span.text-gold')
    await expect(highlighted).toHaveText('@Best Man Ben')
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

test.describe('planning board (Wave 3 item 14 D2)', () => {
  test('renders on the stag party page', async ({ page }) => {
    await mockGuestAuth(page)
    await installPartyApi(page, { stag: true, hen: false }, { stag: baseSummary() })
    await installPartyTaskApi(page, {
      stag: [
        {
          id: 9001,
          wedding_id: 1,
          title: 'Book the minibus',
          description: null,
          status: 'not_started',
          priority: 'medium',
          context: 'stag',
          position: 0,
          due_date: null,
          assigned_to: null,
          category: null,
        },
      ],
    })
    await page.goto('/party/stag')

    const main = mainRegion(page)
    await expect(main.getByRole('heading', { name: 'Planning board' })).toBeVisible()
    await expect(main.getByLabel('Not started column').getByText('Book the minibus')).toBeVisible()
  })

  test('renders on the hen party page', async ({ page }) => {
    await page.route('**/api/auth/me', async (route) => {
      await json(route, {
        id: 7,
        name: 'Maid of Honour Mia',
        role: 'guest',
        wedding_id: 1,
        invite_id: 201,
        guest_id: 7,
        wedding_phase: 'live',
      })
    })
    await installPartyApi(
      page,
      { stag: false, hen: true },
      { hen: baseSummary({ party: 'hen', is_party_admin: true }) },
    )
    await installPartyTaskApi(page)
    await page.goto('/party/hen')

    const main = mainRegion(page)
    await expect(main.getByRole('heading', { name: 'Planning board' })).toBeVisible()
    await expect(main.getByText('No tasks yet')).toBeVisible()
  })

  test('a party member can add a task and move it between columns', async ({ page }) => {
    await mockGuestAuth(page)
    await installPartyApi(page, { stag: true, hen: false }, { stag: baseSummary() })
    await installPartyTaskApi(page)
    await page.goto('/party/stag')

    const main = mainRegion(page)
    await main.getByRole('button', { name: 'Add Task', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Add Task' })).toBeVisible()
    await dialog.getByLabel('Title').fill('Sort out the fancy dress')
    await dialog.getByRole('button', { name: 'Add Task' }).click()

    await expect(
      page.getByRole('status').filter({ hasText: 'Task added successfully.' }),
    ).toBeVisible()
    const notStarted = main.getByLabel('Not started column')
    await expect(notStarted.getByText('Sort out the fancy dress')).toBeVisible()

    // Move it forward via the compact ← → buttons (the accessible/mobile
    // fallback per docs/specs/KANBAN_V2.md) rather than drag & drop.
    await main
      .getByRole('button', { name: 'Move Sort out the fancy dress to next column' })
      .click()

    const inProgress = main.getByLabel('In progress column')
    await expect(inProgress.getByText('Sort out the fancy dress')).toBeVisible()
  })

  test('cross-party isolation: a stag member never sees hen tasks and vice versa', async ({
    page,
  }) => {
    await mockGuestAuth(page)
    await installPartyApi(page, { stag: true, hen: false }, { stag: baseSummary() })
    await installPartyTaskApi(page, {
      stag: [
        {
          id: 9101,
          wedding_id: 1,
          title: 'Stag-only task',
          description: null,
          status: 'not_started',
          priority: 'medium',
          context: 'stag',
          position: 0,
          due_date: null,
          assigned_to: null,
          category: null,
        },
      ],
      hen: [
        {
          id: 9102,
          wedding_id: 1,
          title: 'Hen-only task',
          description: null,
          status: 'not_started',
          priority: 'medium',
          context: 'hen',
          position: 0,
          due_date: null,
          assigned_to: null,
          category: null,
        },
      ],
    })
    await page.goto('/party/stag')

    const main = mainRegion(page)
    await expect(main.getByText('Stag-only task')).toBeVisible()
    await expect(main.getByText('Hen-only task')).toHaveCount(0)
  })
})

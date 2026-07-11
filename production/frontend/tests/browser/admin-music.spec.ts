import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  initializeErrorTracking,
  filterIgnorableErrors,
  getBrowserErrors,
} from './fixtures/page-cleanup'

interface SongRequest {
  id: number
  wedding_id: number
  title: string
  artist: string | null
  source_url: string | null
  dedication: string | null
  requested_by: string
  status: string
  pinned: boolean
  position: number | null
  resolved_title: string | null
  resolved_artist: string | null
  artwork_url: string | null
  spotify_track_id: string | null
  preview_url: string | null
  created_at: string
  reaction_count: number
}

const ARTWORK_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E"

function songRequest(overrides: Partial<SongRequest>): SongRequest {
  return {
    id: 1,
    wedding_id: 1,
    title: 'Untitled',
    artist: null,
    source_url: null,
    dedication: null,
    requested_by: 'Guest',
    status: 'pending',
    pinned: false,
    position: null,
    resolved_title: null,
    resolved_artist: null,
    artwork_url: null,
    spotify_track_id: null,
    preview_url: null,
    created_at: '2026-06-01T10:00:00Z',
    reaction_count: 0,
    ...overrides,
  }
}

const initialRequests: SongRequest[] = [
  // Pending duplicates — the key normalises case and whitespace.
  songRequest({
    id: 101,
    title: 'Dancing Queen',
    artist: 'ABBA',
    dedication: 'For the first dance',
    requested_by: 'Aunt May',
    created_at: '2026-06-01T10:00:00Z',
  }),
  songRequest({
    id: 102,
    title: ' dancing queen ',
    artist: 'Abba',
    requested_by: 'Uncle Bob',
    created_at: '2026-06-02T10:00:00Z',
  }),
  // Pending singleton with resolved metadata and a source link.
  songRequest({
    id: 103,
    title: 'Mr. Brightside',
    requested_by: 'Cousin Jo',
    source_url: 'https://open.spotify.com/track/xyz123',
    resolved_title: 'Mr. Brightside',
    resolved_artist: 'The Killers',
    artwork_url: ARTWORK_DATA_URI,
    spotify_track_id: 'xyz123',
    created_at: '2026-06-03T10:00:00Z',
  }),
  // Approved playlist (positions unset until the first reorder).
  songRequest({
    id: 201,
    title: 'Perfect',
    artist: 'Ed Sheeran',
    requested_by: 'Nan',
    status: 'approved',
    created_at: '2026-05-20T10:00:00Z',
    reaction_count: 3,
  }),
  songRequest({
    id: 202,
    title: 'September',
    artist: 'Earth, Wind & Fire',
    requested_by: 'Ashley',
    status: 'approved',
    preview_url: 'https://audio.example/september.m4a',
    created_at: '2026-05-21T10:00:00Z',
  }),
  // Do-not-play list.
  songRequest({
    id: 301,
    title: 'The Chicken Dance',
    requested_by: 'Uncle Bob',
    status: 'blocked',
    created_at: '2026-05-22T10:00:00Z',
  }),
]

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

interface AdminMusicApiState {
  patches: { id: number; payload: Record<string, unknown> }[]
  merges: { id: number; payload: Record<string, unknown> }[]
  exports: string[]
  previewMatches: number[]
  backfills: number
  nowPlayingPuts: unknown[]
}

async function installAdminMusicApi(
  page: Page,
  initial: SongRequest[],
  nowPlayingId: number | null = null,
): Promise<AdminMusicApiState> {
  const state: AdminMusicApiState = {
    patches: [],
    merges: [],
    exports: [],
    previewMatches: [],
    backfills: 0,
    nowPlayingPuts: [],
  }
  let requests = initial.map((request) => ({ ...request }))
  let currentNowPlayingId = nowPlayingId

  await page.route('**/api/music/now-playing', async (route) => {
    const request = route.request()

    if (request.method() === 'PUT') {
      const payload = request.postDataJSON() as { song_request_id: number | null }
      state.nowPlayingPuts.push(payload)
      currentNowPlayingId = payload.song_request_id
    } else if (request.method() !== 'GET') {
      await json(route, { detail: 'Not found' }, 404)
      return
    }

    const current = requests.find((row) => row.id === currentNowPlayingId) ?? null
    await json(route, {
      now_playing: current ? { ...current, reacted_by_me: false } : null,
    })
  })

  await page.route('**/api/music/requests', async (route) => {
    if (route.request().method() !== 'GET') {
      await json(route, { detail: 'Not found' }, 404)
      return
    }
    // The API returns all requests newest first.
    const sorted = [...requests].sort((a, b) => b.created_at.localeCompare(a.created_at))
    await json(route, sorted)
  })

  await page.route(/\/api\/music\/requests\/(\d+)$/, async (route) => {
    const request = route.request()
    const match = new URL(request.url()).pathname.match(/\/api\/music\/requests\/(\d+)$/)
    const requestId = Number(match?.[1])
    const existing = requests.find((row) => row.id === requestId)

    if (!existing) {
      await json(route, { detail: 'Song request not found' }, 404)
      return
    }

    if (request.method() === 'PATCH') {
      const payload = request.postDataJSON() as Record<string, unknown>
      state.patches.push({ id: requestId, payload })
      const updated = { ...existing, ...payload } as SongRequest
      requests = requests.map((row) => (row.id === requestId ? updated : row))
      await json(route, updated)
      return
    }

    if (request.method() === 'DELETE') {
      requests = requests.filter((row) => row.id !== requestId)
      await route.fulfill({ status: 204, body: '' })
      return
    }

    await json(route, { detail: 'Not found' }, 404)
  })

  await page.route(/\/api\/music\/requests\/(\d+)\/merge$/, async (route) => {
    const match = new URL(route.request().url()).pathname.match(/\/(\d+)\/merge$/)
    const primaryId = Number(match?.[1])
    const payload = route.request().postDataJSON() as { duplicate_ids: number[] }
    state.merges.push({ id: primaryId, payload })

    const primary = requests.find((row) => row.id === primaryId)
    if (!primary) {
      await json(route, { detail: 'Song request not found' }, 404)
      return
    }

    const duplicates = requests.filter((row) => payload.duplicate_ids.includes(row.id))
    const dedications = [primary, ...duplicates]
      .map((row) => row.dedication)
      .filter((dedication): dedication is string => Boolean(dedication))
    const names = [...new Set([primary, ...duplicates].map((row) => row.requested_by))]
    const merged: SongRequest = {
      ...primary,
      dedication: dedications.length > 0 ? dedications.join(' · ') : null,
      requested_by: names.join(', '),
    }
    requests = requests
      .filter((row) => !payload.duplicate_ids.includes(row.id))
      .map((row) => (row.id === primaryId ? merged : row))
    await json(route, merged)
  })

  await page.route(/\/api\/music\/requests\/(\d+)\/match-preview$/, async (route) => {
    const match = new URL(route.request().url()).pathname.match(/\/(\d+)\/match-preview$/)
    const requestId = Number(match?.[1])
    state.previewMatches.push(requestId)
    const existing = requests.find((row) => row.id === requestId)
    if (!existing) {
      await json(route, { detail: 'Song request not found' }, 404)
      return
    }
    const updated = { ...existing, preview_url: 'https://audio.example/matched.m4a' }
    requests = requests.map((row) => (row.id === requestId ? updated : row))
    await json(route, updated)
  })

  await page.route('**/api/music/previews/backfill', async (route) => {
    state.backfills += 1
    let matched = 0
    requests = requests.map((row) => {
      if (row.status === 'approved' && !row.preview_url) {
        matched += 1
        return { ...row, preview_url: 'https://audio.example/backfilled.m4a' }
      }
      return row
    })
    await json(route, { matched, missed: 0 })
  })

  await page.route(/\/api\/music\/export\?format=(csv|text)$/, async (route) => {
    const url = new URL(route.request().url())
    state.exports.push(url.search)
    const isCsv = url.searchParams.get('format') === 'csv'
    await route.fulfill({
      status: 200,
      contentType: isCsv ? 'text/csv' : 'text/plain',
      headers: {
        'Content-Disposition': `attachment; filename="${isCsv ? 'wedding-playlist.csv' : 'dj-pack.txt'}"`,
      },
      body: isCsv
        ? 'position,title,artist,requested_by,dedication,source_url\n'
        : 'WEDDING PLAYLIST\n',
    })
  })

  return state
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)

  await page.route('**/api/auth/me', async (route) => {
    await json(route, {
      id: 1,
      name: 'Test Coordinator',
      role: 'coordinator',
      wedding_id: 1,
      invite_id: 1,
      guest_id: null,
    })
  })
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [])
  expect(unexpectedErrors).toEqual([])
})

function pendingRegion(page: Page) {
  return page.getByRole('region', { name: 'Pending requests' })
}

function approvedRegion(page: Page) {
  return page.getByRole('region', { name: 'Approved playlist' })
}

function blockedRegion(page: Page) {
  return page.getByRole('region', { name: 'Do-not-play list' })
}

test('renders the pending queue with duplicate groups and metadata', async ({ page }) => {
  await installAdminMusicApi(page, initialRequests)
  await page.goto('/admin/music')

  // Both Dancing Queen submissions land in one duplicate group.
  await expect(pendingRegion(page).getByText('Requested by Aunt May')).toBeVisible()
  await expect(pendingRegion(page).getByText('Requested by Uncle Bob')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Merge 2 duplicates' })).toBeVisible()
  await expect(pendingRegion(page).getByText('For the first dance')).toBeVisible()

  // The singleton shows resolved metadata, artwork, and a source link.
  await expect(pendingRegion(page).getByText('Requested by Cousin Jo')).toBeVisible()
  await expect(pendingRegion(page).getByText(/The Killers/)).toBeVisible()
  await expect(
    pendingRegion(page).getByRole('img', { name: 'Artwork for Mr. Brightside' }),
  ).toBeVisible()
  await expect(pendingRegion(page).getByRole('link', { name: 'Open link' })).toHaveAttribute(
    'href',
    'https://open.spotify.com/track/xyz123',
  )

  // The other sections render alongside the queue.
  await expect(approvedRegion(page).getByText('2 songs')).toBeVisible()
  await expect(approvedRegion(page).getByText('Perfect — Ed Sheeran')).toBeVisible()
  await expect(approvedRegion(page).getByText('September — Earth, Wind & Fire')).toBeVisible()
  await expect(blockedRegion(page).getByText('The Chicken Dance')).toBeVisible()
})

test('approving a pending request sends the PATCH and moves it to the playlist', async ({
  page,
}) => {
  const api = await installAdminMusicApi(page, initialRequests)
  await page.goto('/admin/music')

  await page.getByRole('button', { name: 'Approve Mr. Brightside (Cousin Jo)' }).click()

  await expect(page.getByRole('status')).toHaveText('Mr. Brightside approved.')
  expect(api.patches).toEqual([{ id: 103, payload: { status: 'approved' } }])

  await expect(
    approvedRegion(page).getByRole('heading', { name: 'Mr. Brightside' }),
  ).toBeVisible()
  await expect(approvedRegion(page).getByText('3 songs')).toBeVisible()
  await expect(pendingRegion(page).getByText('Requested by Cousin Jo')).not.toBeVisible()
})

test('reject and block send the matching status PATCHes', async ({ page }) => {
  const api = await installAdminMusicApi(page, initialRequests)
  await page.goto('/admin/music')

  await page.getByRole('button', { name: 'Reject dancing queen (Uncle Bob)' }).click()
  await expect(page.getByRole('status')).toHaveText('dancing queen rejected.')

  await page.getByRole('button', { name: 'Block Mr. Brightside (Cousin Jo)' }).click()
  await expect(page.getByRole('status')).toHaveText('Mr. Brightside blocked.')

  expect(api.patches).toEqual([
    { id: 102, payload: { status: 'rejected' } },
    { id: 103, payload: { status: 'blocked' } },
  ])
  await expect(
    blockedRegion(page).getByRole('heading', { name: 'Mr. Brightside' }),
  ).toBeVisible()
})

test('merging duplicates posts the duplicate ids to the first-created primary', async ({
  page,
}) => {
  const api = await installAdminMusicApi(page, initialRequests)
  await page.goto('/admin/music')

  await page.getByRole('button', { name: 'Merge 2 duplicates' }).click()

  await expect(page.getByRole('status')).toHaveText('Merged 1 duplicate into Dancing Queen.')
  expect(api.merges).toEqual([{ id: 101, payload: { duplicate_ids: [102] } }])

  // The group collapses to a single row credited to both requesters.
  await expect(page.getByRole('button', { name: 'Merge 2 duplicates' })).not.toBeVisible()
  await expect(
    pendingRegion(page).getByText('Requested by Aunt May, Uncle Bob'),
  ).toBeVisible()
})

test('the pin toggle sends PATCH pinned and flips to unpin', async ({ page }) => {
  const api = await installAdminMusicApi(page, initialRequests)
  await page.goto('/admin/music')

  await page.getByRole('button', { name: 'Pin Perfect (Nan)' }).click()

  await expect(page.getByRole('status')).toHaveText('Perfect pinned.')
  expect(api.patches).toEqual([{ id: 201, payload: { pinned: true } }])
  await expect(page.getByRole('button', { name: 'Unpin Perfect (Nan)' })).toBeVisible()
})

test('moving a song down assigns sequential positions via PATCH', async ({ page }) => {
  const api = await installAdminMusicApi(page, initialRequests)
  await page.goto('/admin/music')

  // Wall order before reordering: Perfect (first created), then September.
  await expect(page.getByRole('button', { name: 'Move Perfect (Nan) up' })).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Move September (Ashley) down' }),
  ).toBeDisabled()

  await page.getByRole('button', { name: 'Move Perfect (Nan) down' }).click()

  await expect(page.getByRole('status')).toHaveText('Playlist order updated.')
  const positionPatches = [...api.patches].sort((a, b) => a.id - b.id)
  expect(positionPatches).toEqual([
    { id: 201, payload: { position: 2 } },
    { id: 202, payload: { position: 1 } },
  ])

  // The playlist reflects the swap.
  await expect(page.getByRole('button', { name: 'Move September (Ashley) up' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Move Perfect (Nan) down' })).toBeDisabled()
})

test('unblock returns a blocked song to the pending queue', async ({ page }) => {
  const api = await installAdminMusicApi(page, initialRequests)
  await page.goto('/admin/music')

  await page.getByRole('button', { name: 'Unblock The Chicken Dance (Uncle Bob)' }).click()

  await expect(page.getByRole('status')).toHaveText('The Chicken Dance returned to pending.')
  expect(api.patches).toEqual([{ id: 301, payload: { status: 'pending' } }])

  await expect(blockedRegion(page).getByText('No blocked songs.')).toBeVisible()
  await expect(pendingRegion(page).getByText('The Chicken Dance')).toBeVisible()
})

test('the export buttons request the CSV and DJ pack downloads', async ({ page }) => {
  const api = await installAdminMusicApi(page, initialRequests)
  await page.goto('/admin/music')

  await page.getByRole('button', { name: 'Download CSV' }).click()
  await expect.poll(() => api.exports).toEqual(['?format=csv'])

  await page.getByRole('button', { name: 'Download DJ pack (text)' }).click()
  await expect.poll(() => api.exports).toEqual(['?format=csv', '?format=text'])
})

test('shows empty states when there are no requests', async ({ page }) => {
  await installAdminMusicApi(page, [])
  await page.goto('/admin/music')

  await expect(pendingRegion(page).getByText('No pending requests.')).toBeVisible()
  await expect(approvedRegion(page).getByText('No approved songs yet.')).toBeVisible()
  await expect(blockedRegion(page).getByText('No blocked songs.')).toBeVisible()
})

test('preview badges, find preview, and match-all send the right requests', async ({
  page,
}) => {
  const state = await installAdminMusicApi(
    page,
    initialRequests.map((request) => ({ ...request })),
  )
  await page.goto('/admin/music')

  const approved = approvedRegion(page)
  // 202 has a preview; 201 does not.
  await expect(approved.getByText('preview ready')).toHaveCount(1)
  await expect(approved.getByText('no preview', { exact: true })).toHaveCount(1)

  await approved
    .getByRole('button', { name: 'Find preview for Perfect (Nan)' })
    .click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Preview matched for Perfect.' }),
  ).toBeVisible()
  expect(state.previewMatches).toEqual([201])
  await expect(approved.getByText('preview ready')).toHaveCount(2)

  await approved
    .getByRole('button', { name: 'Clear preview for September (Ashley)' })
    .click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Preview cleared for September.' }),
  ).toBeVisible()
  expect(state.patches.at(-1)).toEqual({ id: 202, payload: { preview_url: null } })
})

test('match all previews posts the backfill and reports the count', async ({ page }) => {
  const state = await installAdminMusicApi(
    page,
    initialRequests.map((request) => ({ ...request })),
  )
  await page.goto('/admin/music')

  await page.getByRole('button', { name: 'Match all previews' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Matched 1 preview.' }),
  ).toBeVisible()
  expect(state.backfills).toBe(1)
})

// ---------------------------------------------------------------------------
// Dancefloor v2: ♥ counts + now playing
// ---------------------------------------------------------------------------

test('approved playlist rows show the guest heart counts', async ({ page }) => {
  await installAdminMusicApi(page, initialRequests)
  await page.goto('/admin/music')

  const approved = approvedRegion(page)
  await expect(approved.getByText('♥ 3')).toBeVisible()
  await expect(approved.getByText('♥ 0')).toBeVisible()
})

test('set as now playing sends the PUT and marks the current row', async ({ page }) => {
  const api = await installAdminMusicApi(page, initialRequests)
  await page.goto('/admin/music')

  const approved = approvedRegion(page)
  await expect(approved.getByText('♪ Now playing')).toHaveCount(0)

  await approved
    .getByRole('button', { name: 'Set Perfect (Nan) as now playing' })
    .click()

  await expect(page.getByRole('status')).toHaveText('Perfect is now playing.')
  expect(api.nowPlayingPuts).toEqual([{ song_request_id: 201 }])

  await expect(approved.getByText('♪ Now playing')).toBeVisible()
  await expect(
    approved.getByRole('button', { name: 'Clear now playing (Perfect)' }),
  ).toBeVisible()
})

test('clear now playing sends the null PUT and removes the badge', async ({ page }) => {
  const api = await installAdminMusicApi(page, initialRequests, 202)
  await page.goto('/admin/music')

  const approved = approvedRegion(page)
  await expect(approved.getByText('♪ Now playing')).toBeVisible()

  await approved
    .getByRole('button', { name: 'Clear now playing (September)' })
    .click()

  await expect(page.getByRole('status')).toHaveText('Now playing cleared.')
  expect(api.nowPlayingPuts).toEqual([{ song_request_id: null }])
  await expect(approved.getByText('♪ Now playing')).toHaveCount(0)
})

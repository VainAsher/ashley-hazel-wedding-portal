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
  reacted_by_me: boolean
}

function songRequest(overrides: Partial<SongRequest>): SongRequest {
  return {
    id: 1,
    wedding_id: 1,
    title: 'Untitled',
    artist: null,
    source_url: null,
    dedication: null,
    requested_by: 'Guest',
    status: 'approved',
    pinned: false,
    position: null,
    resolved_title: null,
    resolved_artist: null,
    artwork_url: null,
    spotify_track_id: null,
    preview_url: null,
    created_at: '2026-06-01T10:00:00Z',
    reaction_count: 0,
    reacted_by_me: false,
    ...overrides,
  }
}

const wallEntries: SongRequest[] = [
  songRequest({
    id: 1,
    title: 'Dancing Queen',
    artist: 'ABBA',
    dedication: 'For the happy couple',
    requested_by: 'Aunt May',
    pinned: true,
    position: 1,
  }),
  songRequest({
    id: 2,
    title: 'Mr. Brightside',
    requested_by: 'Uncle Bob',
    position: 2,
  }),
]

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

interface MusicApiState {
  posts: unknown[]
  reactions: { id: number; method: string }[]
}

async function installMusicApi(
  page: Page,
  wall: SongRequest[],
  nowPlayingId: number | null = null,
): Promise<MusicApiState> {
  const state: MusicApiState = { posts: [], reactions: [] }
  let nextId = 1000

  await page.route('**/api/music/requests/wall', async (route) => {
    await json(route, {
      songs: wall,
      now_playing: wall.find((song) => song.id === nowPlayingId) ?? null,
    })
  })

  // Reactions mutate the wall fixture so the post-toggle refetch agrees with
  // the optimistic cache update.
  await page.route(/\/api\/music\/requests\/(\d+)\/react$/, async (route) => {
    const match = new URL(route.request().url()).pathname.match(/\/(\d+)\/react$/)
    const songId = Number(match?.[1])
    const song = wall.find((entry) => entry.id === songId)
    if (!song) {
      await json(route, { detail: 'Song request not found' }, 404)
      return
    }

    const method = route.request().method()
    state.reactions.push({ id: songId, method })

    if (method === 'POST') {
      if (!song.reacted_by_me) {
        song.reacted_by_me = true
        song.reaction_count += 1
      }
      await json(
        route,
        { reaction_count: song.reaction_count, reacted_by_me: true },
        201,
      )
      return
    }

    if (method === 'DELETE') {
      if (song.reacted_by_me) {
        song.reacted_by_me = false
        song.reaction_count = Math.max(0, song.reaction_count - 1)
      }
      await route.fulfill({ status: 204, body: '' })
      return
    }

    await json(route, { detail: 'Not found' }, 404)
  })

  await page.route('**/api/music/requests', async (route) => {
    if (route.request().method() !== 'POST') {
      await json(route, { detail: 'Not found' }, 404)
      return
    }

    const payload = route.request().postDataJSON() as {
      title: string
      artist: string | null
      source_url: string | null
      dedication: string | null
    }
    state.posts.push(payload)
    nextId += 1
    await json(
      route,
      songRequest({
        id: nextId,
        title: payload.title,
        artist: payload.artist,
        source_url: payload.source_url,
        dedication: payload.dedication,
        requested_by: 'Wedding Guest',
        status: 'pending',
      }),
      201,
    )
  })

  return state
}

async function installAuthMe(page: Page, weddingPhase: string) {
  await page.route('**/api/auth/me', async (route) => {
    await json(route, {
      id: 9,
      name: 'Wedding Guest',
      role: 'guest',
      wedding_id: 1,
      invite_id: 3,
      guest_id: 42,
      wedding_phase: weddingPhase,
    })
  })
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)
  await installAuthMe(page, 'live')
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors)
  expect(unexpectedErrors).toEqual([])
})

function songWall(page: Page) {
  return page.getByRole('region', { name: 'Song wall' })
}

test('renders the song wall entries', async ({ page }) => {
  await installMusicApi(page, wallEntries)
  await page.goto('/music')

  await expect(songWall(page).getByText('Dancing Queen — ABBA')).toBeVisible()
  await expect(songWall(page).getByText('Requested by Aunt May')).toBeVisible()
  await expect(songWall(page).getByText('For the happy couple')).toBeVisible()
  await expect(songWall(page).getByTitle('Pinned')).toHaveCount(1)

  await expect(songWall(page).getByText('Mr. Brightside')).toBeVisible()
  await expect(songWall(page).getByText('Requested by Uncle Bob')).toBeVisible()
})

test('shows the empty state when the wall has no songs', async ({ page }) => {
  await installMusicApi(page, [])
  await page.goto('/music')

  await expect(
    page.getByText('No songs yet — be the first to get the dancefloor going!'),
  ).toBeVisible()
})

test('submitting a request posts the payload, shows the success alert, and resets the form', async ({
  page,
}) => {
  const api = await installMusicApi(page, wallEntries)
  await page.goto('/music')

  await page.getByLabel('Song title').fill('September')
  await page.getByLabel('Artist').fill('Earth, Wind & Fire')
  await page.getByLabel('Link').fill('https://open.spotify.com/track/abc123')
  await page.getByLabel('Dedication').fill('First dance, please!')
  await page.getByRole('button', { name: 'Request song' }).click()

  await expect(page.getByRole('status')).toHaveText(
    'Thanks! Your song request is with Ashley & Hazel.',
  )
  expect(api.posts).toEqual([
    {
      title: 'September',
      artist: 'Earth, Wind & Fire',
      source_url: 'https://open.spotify.com/track/abc123',
      dedication: 'First dance, please!',
    },
  ])

  await expect(page.getByLabel('Song title')).toHaveValue('')
  await expect(page.getByLabel('Artist')).toHaveValue('')
  await expect(page.getByLabel('Link')).toHaveValue('')
  await expect(page.getByLabel('Dedication')).toHaveValue('')
})

test('optional fields are sent as null when left blank', async ({ page }) => {
  const api = await installMusicApi(page, [])
  await page.goto('/music')

  await page.getByLabel('Song title').fill('Come On Eileen')
  await page.getByRole('button', { name: 'Request song' }).click()

  await expect(page.getByRole('status')).toHaveText(
    'Thanks! Your song request is with Ashley & Hazel.',
  )
  expect(api.posts).toEqual([
    {
      title: 'Come On Eileen',
      artist: null,
      source_url: null,
      dedication: null,
    },
  ])
})

test('a blank title shows an inline error and does not post', async ({ page }) => {
  const api = await installMusicApi(page, wallEntries)
  await page.goto('/music')

  await page.getByLabel('Song title').fill('   ')
  await page.getByRole('button', { name: 'Request song' }).click()

  await expect(page.getByText('Please enter a song title.')).toBeVisible()
  expect(api.posts).toEqual([])
})

test('hides the form and shows the closed message outside the live phase', async ({ page }) => {
  await page.unroute('**/api/auth/me')
  await installAuthMe(page, 'planning')
  await installMusicApi(page, wallEntries)
  await page.goto('/music')

  await expect(
    page.getByText("Song requests aren't open yet — check back soon."),
  ).toBeVisible()
  await expect(page.getByLabel('Song title')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Request song' })).toHaveCount(0)

  // The wall still shows even while requests are closed.
  await expect(songWall(page).getByText('Dancing Queen — ABBA')).toBeVisible()
})

// ---------------------------------------------------------------------------
// Jukebox (30-second preview player)
// ---------------------------------------------------------------------------

const jukeboxEntries: SongRequest[] = [
  songRequest({
    id: 11,
    title: 'September',
    artist: 'Earth, Wind & Fire',
    requested_by: 'Aunt May',
    dedication: 'Aunties assemble',
    preview_url: 'https://audio.example/september.m4a',
    position: 1,
  }),
  songRequest({
    id: 12,
    title: 'No Preview Song',
    requested_by: 'Uncle Bob',
    position: 2,
  }),
  songRequest({
    id: 13,
    title: 'Could You Be Loved',
    artist: 'Bob Marley',
    requested_by: 'Cousin T',
    preview_url: 'https://audio.example/loved.m4a',
    position: 3,
  }),
]

// Stub out real media playback so the jukebox can "play" in headless CI.
async function stubAudioPlayback(page: Page) {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function play() {
      this.dispatchEvent(new Event('play'))
      return Promise.resolve()
    }
    HTMLMediaElement.prototype.pause = function pause() {
      this.dispatchEvent(new Event('pause'))
    }
  })
}

function jukebox(page: Page) {
  return page.getByRole('region', { name: 'Jukebox' })
}

test('jukebox plays the previewable songs and skips those without previews', async ({
  page,
}) => {
  await stubAudioPlayback(page)
  await installMusicApi(page, jukeboxEntries.map((entry) => ({ ...entry })))
  await page.goto('/music')

  // Queue only contains songs with previews: 2 of the 3 wall entries.
  await expect(jukebox(page).getByText('1 of 2', { exact: false })).toBeVisible()
  await expect(jukebox(page).getByTestId('jukebox-title')).toHaveText(
    'September — Earth, Wind & Fire',
  )
  await expect(jukebox(page).getByText('Requested by Aunt May')).toBeVisible()

  await jukebox(page).getByRole('button', { name: 'Play the jukebox' }).click()
  await expect(
    jukebox(page).getByRole('button', { name: 'Pause the jukebox' }),
  ).toBeVisible()

  // Next skips straight to the other previewable song (id 13, not 12).
  await jukebox(page).getByRole('button', { name: 'Next song' }).click()
  await expect(jukebox(page).getByTestId('jukebox-title')).toHaveText(
    'Could You Be Loved — Bob Marley',
  )
})

test('jukebox advances on track end and loops back to the start', async ({ page }) => {
  await stubAudioPlayback(page)
  await installMusicApi(page, jukeboxEntries.map((entry) => ({ ...entry })))
  await page.goto('/music')

  const audio = page.getByTestId('jukebox-audio')
  await expect(jukebox(page).getByTestId('jukebox-title')).toHaveText(
    'September — Earth, Wind & Fire',
  )

  // Track 1 ends -> advance to track 2.
  await audio.evaluate((element) => element.dispatchEvent(new Event('ended')))
  await expect(jukebox(page).getByTestId('jukebox-title')).toHaveText(
    'Could You Be Loved — Bob Marley',
  )

  // Track 2 ends -> loop back to track 1.
  await audio.evaluate((element) => element.dispatchEvent(new Event('ended')))
  await expect(jukebox(page).getByTestId('jukebox-title')).toHaveText(
    'September — Earth, Wind & Fire',
  )
})

test('no jukebox renders when no wall songs have previews', async ({ page }) => {
  await installMusicApi(page, wallEntries.map((entry) => ({ ...entry })))
  await page.goto('/music')

  await expect(songWall(page).getByText('Dancing Queen — ABBA')).toBeVisible()
  await expect(jukebox(page)).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// ♥ reactions (Dancefloor v2)
// ---------------------------------------------------------------------------

test('the heart toggle posts a reaction and updates the count optimistically', async ({
  page,
}) => {
  const api = await installMusicApi(page, [
    songRequest({ id: 21, title: 'Dancing Queen', artist: 'ABBA', reaction_count: 2 }),
    songRequest({ id: 22, title: 'Mr. Brightside', requested_by: 'Uncle Bob' }),
  ])
  await page.goto('/music')

  const heart = songWall(page).getByRole('button', {
    name: 'Give a heart to Dancing Queen',
  })
  await expect(heart).toBeVisible()
  await expect(heart.getByTestId('reaction-count')).toHaveText('2')

  await heart.click()

  const filled = songWall(page).getByRole('button', {
    name: 'Remove your heart from Dancing Queen',
  })
  await expect(filled).toBeVisible()
  await expect(filled).toHaveAttribute('aria-pressed', 'true')
  await expect(filled.getByTestId('reaction-count')).toHaveText('3')
  await expect.poll(() => api.reactions).toEqual([{ id: 21, method: 'POST' }])

  // The untouched song keeps its own count.
  await expect(
    songWall(page)
      .getByRole('button', { name: 'Give a heart to Mr. Brightside' })
      .getByTestId('reaction-count'),
  ).toHaveText('0')
})

test('tapping a filled heart removes the reaction via DELETE', async ({ page }) => {
  const api = await installMusicApi(page, [
    songRequest({
      id: 31,
      title: 'September',
      artist: 'Earth, Wind & Fire',
      reaction_count: 5,
      reacted_by_me: true,
    }),
  ])
  await page.goto('/music')

  const filled = songWall(page).getByRole('button', {
    name: 'Remove your heart from September',
  })
  await expect(filled.getByTestId('reaction-count')).toHaveText('5')

  await filled.click()

  const empty = songWall(page).getByRole('button', {
    name: 'Give a heart to September',
  })
  await expect(empty).toBeVisible()
  await expect(empty).toHaveAttribute('aria-pressed', 'false')
  await expect(empty.getByTestId('reaction-count')).toHaveText('4')
  await expect.poll(() => api.reactions).toEqual([{ id: 31, method: 'DELETE' }])
})

// ---------------------------------------------------------------------------
// Currently playing (Dancefloor v2)
// ---------------------------------------------------------------------------

test('shows the currently-playing card when the couple set a song', async ({ page }) => {
  await installMusicApi(
    page,
    [
      songRequest({
        id: 41,
        title: 'Perfect',
        artist: 'Ed Sheeran',
        requested_by: 'Nan',
        artwork_url:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E",
      }),
      songRequest({ id: 42, title: 'Mr. Brightside', requested_by: 'Uncle Bob' }),
    ],
    41,
  )
  await page.goto('/music')

  const nowPlaying = page.getByRole('region', { name: 'Currently playing' })
  await expect(nowPlaying).toBeVisible()
  await expect(nowPlaying.getByTestId('now-playing-title')).toHaveText(
    'Perfect — Ed Sheeran',
  )
  await expect(nowPlaying.getByText('Picked by Ashley & Hazel')).toBeVisible()
})

test('no currently-playing card renders when nothing is set', async ({ page }) => {
  await installMusicApi(page, wallEntries.map((entry) => ({ ...entry })))
  await page.goto('/music')

  await expect(songWall(page).getByText('Dancing Queen — ABBA')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Currently playing' })).toHaveCount(0)
})

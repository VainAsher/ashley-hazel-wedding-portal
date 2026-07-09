# Dancefloor — Guest Music Requests & Playlist Curation

Build contract for the music feature (agreed 2026-07-09, from the architecture
review). This is the single source of truth for the backend and frontend build
agents. Follow it exactly; if something is impossible, stop and report rather
than improvising a different contract.

Origin: the prototype's Dancefloor screen (repo-root `index.html:99–110`) —
free-text song requests with dedications, a public song wall, couple curation,
and a DJ export. The pattern to clone is the gallery moderation pipeline
(`app/api/gallery.py`).

## Data model

Table `song_requests` (migration `013_create_song_requests.sql`):

| column | type | notes |
|---|---|---|
| id | SERIAL PK | |
| wedding_id | INT NOT NULL FK weddings ON DELETE CASCADE | |
| title | VARCHAR(255) NOT NULL | raw guest input |
| artist | VARCHAR(255) NULL | |
| source_url | VARCHAR(500) NULL | pasted Spotify/YouTube/other link |
| dedication | VARCHAR(500) NULL | shown publicly on the wall |
| requested_by | VARCHAR(255) NOT NULL | display name, from session user |
| status | VARCHAR(20) NOT NULL DEFAULT 'pending' | CHECK: pending/approved/rejected/blocked |
| pinned | BOOLEAN NOT NULL DEFAULT FALSE | |
| position | INT NULL | final playlist ordering (approved only) |
| resolved_title | VARCHAR(255) NULL | from oEmbed |
| resolved_artist | VARCHAR(255) NULL | from oEmbed |
| artwork_url | VARCHAR(500) NULL | from oEmbed |
| spotify_track_id | VARCHAR(64) NULL | parsed from a Spotify URL |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | |

Indexes: (wedding_id, status), (wedding_id, created_at DESC).
`blocked` = the DJ do-not-play list.

## API (`app/api/music.py`, prefix `/api/music`, tag `music`)

All responses use `SongRequestResponse`: id, wedding_id, title, artist,
source_url, dedication, requested_by, status, pinned, position,
resolved_title, resolved_artist, artwork_url, spotify_track_id, created_at.

| Endpoint | Auth | Behaviour |
|---|---|---|
| POST `/requests` | require_guest | Body: title (required, 1–255, strip+reject blank), artist?, source_url?, dedication?. Guests: status=`pending`; couple/coordinator callers: status=`approved`. Guests are rejected 403 when `wedding.phase != 'live'` (couple/coordinator exempt). `requested_by` = current_user.name. Best-effort metadata resolution on source_url (see below). 201. |
| GET `/requests/wall` | require_guest | Approved only. Order: pinned DESC, position ASC NULLS LAST, created_at ASC. |
| GET `/requests` | require_coordinator | All for the wedding, newest first. |
| PATCH `/requests/{id}` | require_coordinator | Partial update: title, artist, dedication, status, pinned, position. 404 if not found, 403 if other wedding. Invalid status → 422. |
| DELETE `/requests/{id}` | require_coordinator | 204. |
| POST `/requests/{id}/merge` | require_coordinator | Body: `{"duplicate_ids": [int, ...]}`. Folds duplicates into {id}: dedications joined with " · " (skipping nulls), requested_by names joined with ", " (deduped), then duplicates deleted. Errors 400 if any id is the primary itself or belongs to another wedding; 404 unknown ids. Returns updated primary. |
| GET `/export?format=csv|text` | require_coordinator | DJ pack. CSV columns: position,title,artist,requested_by,dedication,source_url — approved rows in wall order, then a `# DO NOT PLAY` comment section is NOT in csv (csv = approved only). `text` format: printable pack — "WEDDING PLAYLIST" section (numbered, pinned marked ★) then "DO NOT PLAY" section listing blocked rows. Content-Disposition attachment (`wedding-playlist.csv` / `dj-pack.txt`). |

Register the router in `app/main.py` alongside the others.

## Metadata resolution (`app/utils/music_metadata.py`)

`resolve_music_url(url: str) -> MusicMetadata | None` where MusicMetadata is a
small dataclass/NamedTuple: resolved_title, resolved_artist, artwork_url,
spotify_track_id.

- Detect Spotify track URLs (`open.spotify.com/track/<id>`; also parse the id)
  and YouTube URLs (youtube.com/watch, youtu.be).
- Fetch the provider's public oEmbed endpoint
  (`https://open.spotify.com/oembed?url=...`,
  `https://www.youtube.com/oembed?url=...&format=json`) with a 3-second
  timeout. Spotify oEmbed `title` is the track title; YouTube `title` is the
  video title and `author_name` the channel (use as artist).
- ANY failure (timeout, non-200, bad JSON, unrecognised URL) returns None —
  never raise, never block a submission.
- Use an existing HTTP dependency (httpx is already in the backend's
  dependency tree via fastapi/testclient — check requirements before adding
  anything; do NOT add new dependencies).
- The router must call this through a module-level function so tests can
  monkeypatch it. Backend tests MUST NOT perform real network calls.

## Backend tests (`tests/test_music.py`)

Written FIRST (red), then implementation (green). Clone the structure of
`tests/test_gallery.py` / `tests/test_settings.py` (fixtures:
`coordinator_session`, `guest_session`, `client`, `db_session`;
`TEST_WEDDING_ID` from `tests.fixtures.guests`). The seed wedding's phase must
be handled: set/restore phase in fixtures where the test needs `live`
(see `restore_wedding` snapshot pattern in `test_settings.py`).

Minimum coverage: guest submit → pending (metadata resolver monkeypatched);
blank title 422; guest submit blocked in planning phase 403; coordinator
create → approved; wall shows approved only and ordering (pinned first, then
position); admin list requires coordinator (guest 403); patch status
transitions + invalid status 422; cross-wedding 403/404 guard (see how other
suites do this — if no cross-wedding fixture exists, cover 404 unknown id);
merge happy path (dedications/requesters folded, duplicates gone) + merge
errors; export csv (status 200, text/csv, correct rows/order) + export text
(both sections); unauthenticated 401s.

Run against the dedicated agent test DB (a throwaway database on the staging
Postgres — schema+migrations 002–012+seed already applied). From
`production/backend`:

`DATABASE_URL=postgresql://test_agent:test_agent_pw@192.168.0.32:5432/wedding_test_agent python -m pytest tests/test_music.py -q`

Apply YOUR new migration 013 to it before the first run:
`ssh deploy@192.168.0.32 'docker exec -i wedding-postgresql psql -U test_agent -d wedding_test_agent -v ON_ERROR_STOP=1' < production/database/migrations/013_create_song_requests.sql`
(run from the repo root; passwordless SSH is configured).

IMPORTANT (this machine): run pytest through the PowerShell tool in the
FOREGROUND — the Bash tool's sandbox blocks the DB connection. Pattern:
`Set-Location <repo>\production\backend; $env:DATABASE_URL='postgresql://test_agent:test_agent_pw@192.168.0.32:5432/wedding_test_agent'; python -m pytest tests/test_music.py -q`
Verified working: the settings suite passes in <1s this way.

## CI (backend agent's responsibility)

Add `013_create_song_requests.sql` to BOTH hardcoded migration lists in
`.github/workflows/test.yml` (after the 012 lines, ~line 73 and ~line 168).
This was missed for 012 and broke CI — do not repeat it.

## Frontend — guest (frontend agent)

Convention trio: `src/api/music.ts` → `src/hooks/useMusic.ts` →
`src/pages/Music.tsx`. Follow `api/blessings.ts` / `hooks/useBlessings.ts` /
`pages/Blessings.tsx` as the closest template (guest form + list page).

- Route `/music`, lazy-loaded in `App.tsx` as a guest route (copy the
  Blessings route pattern). Nav label **"Dancefloor"** added to
  `GuestLayout.tsx` navigationItems (after Blessings, before Gallery).
  `usePageTitle('Dancefloor')`.
- Page layout (all inside `GuestLayout`, styled like Blessings — Cards, gold
  buttons come free from the theme):
  1. Header card: title "Dancefloor", description "Help build the wedding
     soundtrack — request a song and see what everyone else picked."
  2. Request form card ("Request a song"): Song title (required), Artist
     (optional), Link (optional, placeholder "Spotify or YouTube link
     (optional)"), Dedication (optional textarea, hint that it appears
     publicly on the wall). Name is NOT asked — the session provides it.
     Client-side: block empty title with an inline error. On success reset the
     form and show success alert (role=status): "Thanks! Your song request is
     with Ashley & Hazel." POST body: {title, artist, source_url, dedication}
     with null for empties (see optionalText() in RSVP.tsx).
  3. Song wall: `GET /api/music/requests/wall`; cards with title (+ artist),
     "Requested by {name}", dedication in italics if present, a small ★ for
     pinned. Empty state card: "No songs yet — be the first to get the
     dancefloor going!"
- Phase gating: same pattern as `pages/RSVP.tsx` (fetchCurrentUser →
  wedding_phase). When phase !== 'live', hide the form and show the closed
  message "Song requests aren't open yet — check back soon." The wall may
  still show.
- Playwright `tests/browser/music.spec.ts`, mocked like
  `tests/browser/blessings.spec.ts` (use `cleanupPageState`/error-tracking
  fixtures; mock `**/api/auth/me`, `**/api/music/requests/wall`,
  `**/api/music/requests`). Cover: wall renders entries; empty state; submit
  posts correct payload + success alert + form reset; blank-title validation;
  phase-closed state. Console must stay clean (the shared fixture already
  answers /api/portal/theme).

## Frontend — admin (admin agent, runs after the other two)

`src/pages/admin/Music.tsx`, lazy admin route `/admin/music` (copy an existing
admin route in `App.tsx`), menu item in `AdminLayout.tsx` adminMenuItems:
`{ label: 'Music', href: '/admin/music', icon: '🎵' }` (between Gallery and
Blessings). Extend `src/api/music.ts` + `src/hooks/useMusic.ts` with the admin
calls (list all, patch, delete, merge, export URL helper).

Page sections (follow `pages/admin/Gallery.tsx` + `pages/admin/Blessings.tsx`
for structure/feedback conventions, AdminLayout title "Music"):
1. **Pending requests** — grouped by duplicate key
   `lower(trim(title))|lower(trim(artist ?? ''))`. Groups with >1 show a
   "Merge {n} duplicates" button → POST merge (first id primary). Each row:
   title/artist, requested by, dedication, resolved metadata + artwork thumb
   when present, link out if source_url. Actions: Approve / Reject / Block
   (PATCH status). Empty state: "No pending requests."
2. **Approved playlist** — wall order; per row: pin toggle (★), move up/down
   (swaps `position`; when positions are null, first reorder assigns
   sequential positions), Reject (demote). Count badge.
3. **Do-not-play list** — blocked rows, with "Unblock" (→ pending).
4. **Export** — two buttons: "Download CSV" and "Download DJ pack (text)" —
   fetch with credentials and trigger a browser download (blob + anchor).
Feedback via Alert components like other admin pages.

Playwright `tests/browser/admin-music.spec.ts` (coordinator auth/me mock, like
`admin-blessings.spec.ts`): pending queue renders groups; approve sends PATCH;
merge sends POST with correct ids; pin toggle sends PATCH; export click issues
the GET (assert via routed request); empty states. Console clean.

## Shared rules for every agent

- Do NOT commit, push, or deploy — leave changes in the working tree.
- Do NOT touch files outside your listed scope. Backend scope:
  `production/backend/**`, `production/database/**`,
  `.github/workflows/test.yml`. Guest-frontend scope:
  `production/frontend/src/{api/music.ts,hooks/useMusic.ts,pages/Music.tsx,App.tsx,components/GuestLayout.tsx}`
  + `production/frontend/tests/browser/music.spec.ts`. Admin scope:
  `production/frontend/src/{api/music.ts,hooks/useMusic.ts,pages/admin/Music.tsx,App.tsx,components/AdminLayout.tsx}`
  + `production/frontend/tests/browser/admin-music.spec.ts`.
- No new npm/pip dependencies.
- Tests first (write them, watch them fail for the right reason), then
  implement to green. Finish by running YOUR OWN full validation:
  backend agent → `python -m pytest tests -q` (whole suite) with the local
  DATABASE_URL; frontend agents → `npx tsc --noEmit` and
  `npx playwright test <your spec> --reporter=line` from
  `production/frontend`.
- Match surrounding code style exactly (comment density, naming, error
  handling, logging patterns).
- Report back: files changed, test results (exact counts), any contract
  deviations or discovered issues.

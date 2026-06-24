# Frontend E2E Testing

The frontend uses Playwright for browser-based E2E coverage. The suite is
**green** in CI: 21 spec files, roughly 216 tests passing across two browser
projects.

## Test Location

- Deterministic, mocked browser tests: `production/frontend/tests/browser/*.spec.ts`
- Shared auth/cleanup helpers: `production/frontend/tests/browser/fixtures/`
  (`auth.fixture.ts`, `page-cleanup.ts`)
- Opt-in live API flows (skipped by default): `guest-management-live.spec.ts`
  and the live half of `rsvp-flow.spec.ts`

The mocked suite covers navigation, dashboard, guest CRUD, invite management,
RSVP (guest + admin), events, timeline/schedule, budget, vendors,
communications, gallery, blessings, settings, and auth routing — across desktop
and mobile viewports.

## How The Suite Stays Green (Auth Mocking)

Every page hits authenticated endpoints. Rather than fall through to a live
backend (which returns `401` behind the auth wall), each spec mocks its API
surface so the run is hermetic:

- `GET /api/auth/me` is mocked to return a seeded user (couple / coordinator /
  guest) via the `auth.fixture.ts` helpers (`mockCurrentUser`,
  `preAuthenticateUser`, and the `authenticatedCouplePage` / `authenticatedGuestPage`
  / `authenticatedCoordinatorPage` fixtures). `POST /api/auth/login` is mocked
  by `mockLoginEndpoint`.
- Each spec additionally mocks the data endpoints it needs (`/api/guests`,
  `/api/invites`, etc.) with `page.route`.
- `page-cleanup.ts` resets routes, cookies, and storage between tests and
  installs console/page-error tracking. The error assertion ignores expected
  noise (401s on unmocked routes, `net::ERR_FAILED`, headless clipboard
  warnings) so transient resource errors don't fail otherwise-passing tests.

This is the fix for the historical "auth wall" failures — see
`production/TROUBLESHOOTING_GUIDE.md` Issue 6 (now resolved).

## Local Commands

```bash
cd production/frontend
npm ci
npx playwright install chromium
npm run test:e2e
```

Use a different dev-server port when another server is already running:

```bash
PLAYWRIGHT_PORT=3200 npm run test:e2e
```

## Playwright Config

`production/frontend/playwright.config.ts`:

- Two projects: `chromium-desktop` (1366x900) and `chromium-mobile` (Pixel 5).
- Dev server started on `127.0.0.1:${PLAYWRIGHT_PORT:-3100}` (`--strictPort`),
  headless, `reuseExistingServer: false`.
- Screenshots only on failure, traces retained on failure.

## CI Behavior

The unified `Tests` workflow runs the suite on every push to `main`, every
`week2/**` branch push, and every pull request to `main`. The frontend job
builds and starts the backend Docker image, initializes/seeds the DB, runs an
unmocked real-login smoke test, then runs Playwright with
`npm run test:e2e -- --reporter=line,html`. It uploads the
`frontend-playwright-report` artifact (Playwright report + `test-results`).

## Live API Flows

Live flows are skipped unless `LIVE_E2E=1`. Run them only against an
environment you are prepared to mutate:

```bash
cd production/frontend
LIVE_E2E=1 LIVE_API_URL=http://127.0.0.1:3001 npm run test:e2e -- guest-management-live.spec.ts
```

The live guest-management test creates a uniquely named guest, verifies API
persistence, updates the row, deletes it, and attempts cleanup if an assertion
fails. `rsvp-flow.spec.ts` similarly switches to the live backend when
`LIVE_E2E=1` is set.

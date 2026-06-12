# Frontend E2E Testing

The frontend uses Playwright for browser-based E2E coverage.

## Test Location

- Mocked deterministic browser tests: `production/frontend/tests/browser/*.spec.ts`
- Optional live API browser flow: `production/frontend/tests/browser/guest-management-live.spec.ts`

The mocked suite covers navigation, guest create/read/update/delete workflows,
validation errors, delete confirmation handling, empty states, plus-one/dietary
fields, and mobile viewport behavior.

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

## CI Behavior

The unified `Tests` workflow runs frontend browser tests on every push to
`main`, every `week2/**` branch push, and every pull request to `main`.

The Playwright config runs Chromium desktop and mobile projects in headless
mode. It records screenshots only on failure and retains traces on failure.
The workflow uploads `playwright-report` and `test-results` artifacts.

## Live API Flow

The live browser flow is skipped by default. Run it only against an environment
you are prepared to mutate:

```bash
cd production/frontend
LIVE_E2E=1 LIVE_API_URL=http://127.0.0.1:3001 npm run test:e2e -- guest-management-live.spec.ts
```

The live test creates a uniquely named guest, verifies API persistence, updates
the row, deletes it, and attempts cleanup if an assertion fails.

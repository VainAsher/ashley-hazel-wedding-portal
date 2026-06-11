# GitHub Actions Test Workflow

Week 2 Task 007 adds `.github/workflows/test.yml` to run backend and frontend
tests automatically on pushes to `main` and `week2/**`, pull requests targeting
`main`, and manual dispatches.

## Backend Job

The backend job starts PostgreSQL 15, initializes the test database with the
base schema and Week 2 migrations, installs FastAPI test dependencies, and runs:

```bash
cd production/backend
python -m pytest tests -q --cov=app --cov-report=xml --cov-report=html
```

Coverage output is uploaded as the `backend-coverage` artifact.

## Frontend Job

The frontend job installs Node dependencies, verifies the Vite production build,
installs Chromium for Playwright, and runs:

```bash
cd production/frontend
npm test -- --reporter=line,html
```

The existing live browser test remains skipped unless `LIVE_E2E=1` and a live
API URL are provided. Playwright reports are uploaded as the
`frontend-playwright-report` artifact.

## Local Parity

Backend:

```bash
cd production/backend
set -a && . ./.env && set +a
python -m pytest tests -q
```

Frontend:

```bash
cd production/frontend
npm ci
npm run build
npm test
```

If `127.0.0.1:3100` is already occupied locally, run browser tests on a
different port:

```bash
PLAYWRIGHT_PORT=3101 npm test
```

## Merge Expectations

Pull requests should keep both CI jobs green before merge. Backend coverage is
available from the workflow artifacts; frontend browser evidence is available in
the Playwright report artifact.

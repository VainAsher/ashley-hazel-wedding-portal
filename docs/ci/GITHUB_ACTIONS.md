# GitHub Actions Test Workflow

Week 2 Task 007 adds `.github/workflows/test.yml` to run backend and frontend
tests automatically on pushes to `main` and `week2/**`, pull requests targeting
`main`, and manual dispatches.

The workflow pins `ubuntu-22.04` because the current Playwright version's
`install --with-deps` command expects Ubuntu 22.04 package names.

## Backend Job

The backend job starts a PostgreSQL 15 service, initializes the test database
with `schema.sql` plus migrations 002–007 and 009–011, seeds it with migration
008, installs FastAPI test dependencies (plus `pytest-cov`), and runs:

```bash
cd production/backend
python -m pytest tests -q --cov=app --cov-report=xml --cov-report=html
```

Coverage output (`coverage.xml` + `htmlcov`) is uploaded as the
`backend-coverage` artifact.

## Frontend Job

The frontend job does more than run Playwright — it stands up the real backend
so the suite runs against a true frontend→backend contract:

1. Starts a PostgreSQL 15 service.
2. Builds the backend Docker image (`docker build production/backend`) and runs
   it as a host-network service with `SESSION_COOKIE_SECURE=false`.
3. Waits for `GET /health` to return.
4. Initializes the DB (`schema.sql` + migrations 002–007, 009–011) and seeds it
   with migration 008.
5. Runs an **unmocked real-login smoke test**: `POST /api/auth/login` with
   `{"invite_code":"DEMO-COUPLE"}` must return `200` containing
   `"role":"couple"`, then `GET /health/ready` must return `200`. The mocked
   Playwright suite never exercises the real auth path, so this guards it.
6. Installs Node deps (`npm ci`), builds the frontend (`npm run build`),
   installs Chromium, then runs:

```bash
cd production/frontend
npm run test:e2e -- --reporter=line,html
```

Live browser flows stay skipped unless `LIVE_E2E=1` is set. The Playwright
report (and `test-results`) is uploaded as the `frontend-playwright-report`
artifact; backend container logs are dumped on failure.

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
npm run test:e2e
```

If `127.0.0.1:3100` is already occupied locally, run browser tests on a
different port:

```bash
PLAYWRIGHT_PORT=3101 npm run test:e2e
```

## Merge Expectations

Pull requests should keep both CI jobs green before merge. Backend coverage is
available from the workflow artifacts; frontend browser evidence is available in
the Playwright report artifact.

Deployment automation is documented in [DEPLOYMENT.md](DEPLOYMENT.md).

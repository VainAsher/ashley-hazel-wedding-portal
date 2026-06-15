# E2E VALIDATION REPORT — Agent 7

**Environment:** staging VM `192.168.0.32`, dockerized stack (validation host ports `8088`/`3010`/`5433`).
**Date:** 2026-06-15.

## Endpoint / Integration Validation (containerized stack)

| # | Test | Command (host) | Result | Verdict |
|---|------|----------------|--------|---------|
| 1 | Backend health | `curl localhost:3010/health` | `200` · `{"status":"healthy","message":"Wedding Dashboard API is running!"}` | PASS |
| 2 | Frontend health | `curl localhost:8088/healthz` | `200` · `ok` | PASS |
| 3 | Frontend SPA root | `curl localhost:8088/` | `200` · index.html (328 B) | PASS |
| 4 | API reverse proxy (nginx → backend) | `curl localhost:8088/api/guests` | `401` · `{"detail":"Not authenticated"}` | PASS* |
| 5 | DB connectivity (pg_isready) | `docker exec wedding-postgresql pg_isready -U wedding -d wedding_dev` | `accepting connections` | PASS |
| 6 | Schema initialized | `psql \dt` | 14 tables (guests, users, weddings, invites, …) | PASS |
| 7 | Full DB roundtrip via proxy | `POST /api/auth/login {invite_code:"NONEXISTENT"}` | `401` · `{"detail":"Invalid invite code"}` — backend queried `invites` table | PASS |
| 8 | Data persistence | marker row survived `compose down` → `up` (pgdata volume) | row intact | PASS |

\* A `401` is the CORRECT response: `/api/guests` is auth-walled (per earlier security fixes). The
request reaching the backend with the same status as a direct backend call proves the nginx `/api/`
reverse proxy works. Backend logs show the proxied request arriving from the nginx container IP
`172.18.0.4`, confirming the full path frontend(nginx) → backend.

## Playwright Browser E2E Suite

- **Location:** `production/frontend/tests/browser/` — 8 spec files
  (auth-routing, guest-management, guest-management-live, invite-management, invite, navigation,
  rsvp-flow, rsvp).
- **Nature:** Component/UI E2E that **mock the API** via `page.route('**/api/...')` and run against
  the suite's OWN Vite dev server (`webServer` on port 3100, `reuseExistingServer:false`). They
  validate the built frontend + routing + UI flows; they do NOT exercise the live containerized
  backend (which is covered by tests 1–8 above).
- **Run command:** `PLAYWRIGHT_PORT=3100 npx playwright test --reporter=list`
- **Result:** see "Playwright Result" section below (run took >25 min due to per-test Vite
  server restarts across two browser projects).

### Playwright Result — COMPLETED (NOT all passing)

```
37 passed
 2 skipped
49 failed       (run time 22.0 min, exit 1)
```

This does NOT match the brief's claimed "86/86 passing". Actual: **37 passed / 49 failed / 2 skipped**
(88 total = 44 tests × 2 browser projects, chromium-desktop + chromium-mobile).

**Which specs:**
- PASS: `auth-routing`, `rsvp`, `rsvp-flow`, `guest-management-live`, `invite`(desktop), and some
  `navigation` cases.
- FAIL: most of `guest-management.spec.ts`, `invite-management.spec.ts`, and `navigation.spec.ts`
  (both desktop and mobile projects).

**Root cause (diagnosed, NOT a deployment defect):** test-vs-backend contract drift.
- The suite mocks only specific routes (e.g. `/api/guests`, `/api/invites`). The app under test ALSO
  issues other unmocked API calls (e.g. an auth/session check). Unmocked `/api/*` calls fall through
  the suite's Vite dev-server proxy to `http://127.0.0.1:3001` — the LIVE bare-metal FastAPI on the
  VM — which now returns **401 Unauthorized** because of the auth walls added in commit
  `9be1c4f "Fix critical security issues: auth walls and data leakage"`.
- Each failing spec has a `beforeEach` console listener + teardown assertion `expect(unexpectedErrors).toEqual([])`.
  The 401 "Failed to load resource" console errors break that assertion, and the primary assertions
  (e.g. `'1 guests'` visible) also fail because the unmocked data never loads.

Representative failure (`guest-management.spec.ts:144`):
```
expect(received).toEqual(expected)
+ "Failed to load resource: the server responded with a status of 401 (Unauthorized)"
+ "Failed to load resource: the server responded with a status of 401 (Unauthorized)"
```

**Conclusion:** This is a STALE FRONTEND TEST SUITE that predates the backend auth-wall security fix —
it needs its mocks updated to cover the auth/session endpoints (or the proxy fallthrough blocked).
It is INDEPENDENT of the containerized deployment, which is fully healthy. It must be fixed before
it can serve as a CI gate, but it does NOT block the staging deployment's validity.

## Summary

- Containerized deployment + integration validation (tests 1–8): **PASS (8/8).**
- Playwright UI suite: **37 passed / 49 failed / 2 skipped** — failures are stale-test/backend
  auth-wall drift (see above), NOT a deployment defect.

**Overall deployment validation: PASS (with a flagged test-suite issue).** All three services build,
start, become healthy, and serve correctly; reverse proxy, database roundtrip, and volume persistence
all verified. The Playwright failures are a pre-existing frontend test-maintenance problem (mocks
don't cover the auth endpoints the post-security-fix backend requires) and must be fixed before the
suite can gate CI — but they do not invalidate the containerized staging deployment.

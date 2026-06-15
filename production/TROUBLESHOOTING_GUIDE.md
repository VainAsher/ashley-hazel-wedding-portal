# TROUBLESHOOTING GUIDE — Agent 7 Staging Deploy

Issues encountered during the real staging deployment, their root causes, fixes, and verification.

---

## Issue 1 — Docker not installed on the VM

- **Symptom:** `docker: command not found`; `docker-compose: command not found` on `192.168.0.32`.
- **Root cause:** Docker Engine was never installed on `wedding-db`. The deployment brief assumed
  it was present.
- **Fix:** Installed from Docker's official apt repo:
  ```bash
  sudo install -m0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu noble stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker deploy
  ```
- **Verification:** `docker --version` → 29.5.3; `docker compose version` → v5.1.4; daemon `active`.
- **NOTE:** The `deploy` user's `docker` group membership applies to NEW login sessions. Existing
  sessions may need `newgrp docker` or a re-login; this run used the working socket access directly.

## Issue 2 — Docker artifacts absent on the VM

- **Symptom:** `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` not found; the
  on-VM `scripts/deploy.sh` was the OLD bare-metal version (7913 B), not the Docker one (18500 B).
- **Root cause:** Agents 2–6 produced these files in the local working tree only; they were never
  committed/pushed and the VM repo (HEAD `27f26b9`) never pulled them.
- **Fix:** `scp` the artifacts from the local working tree to the VM (old `deploy.sh` backed up to
  `deploy.sh.baremetal.bak`). For production, these should instead be committed to the repo and
  delivered via `git pull` (the GitHub Actions workflow from Agent 6 assumes a checked-out tree).
- **Verification:** `wc -l scripts/deploy.sh` → 528 lines; all Dockerfiles/compose present.

## Issue 3 — Host-port collision with the live bare-metal dev stack

- **Symptom:** `failed to bind host port 0.0.0.0:5432/tcp: address already in use`.
- **Root cause:** The live dev stack (system PostgreSQL on 5432, FastAPI on 3001, Vite on 3000) was
  still running; `docker-compose.yml` published 5432 and 3001 on the host. An attempt to fix it with
  a `!reset`/override file did not work because compose MERGES port lists by appending (a `ports:`
  list cannot be reduced via override-file merge the way mapping keys can).
- **Fix:** Parameterized the base compose host ports:
  `${POSTGRES_HOST_PORT:-5432}`, `${BACKEND_HOST_PORT:-3001}`, `${FRONTEND_HOST_PORT:-80}`
  (the frontend was already parameterized). The validation run set `5433 / 3010 / 8088` in
  `.env.test`. Container-internal ports unchanged. Pre-edit file saved as `docker-compose.yml.orig.bak`.
- **Verification:** `docker compose config` showed published `5433 / 3010 / 8088`; stack came up.
- **PRODUCTION IMPLICATION:** Before a real production deploy on this host, the bare-metal dev stack
  MUST be stopped so the containers can claim the canonical ports (or production runs behind Traefik
  with no direct host publishing — see PRODUCTION_READINESS_CHECKLIST).

## Issue 4 — Backend unhealthy: missing required staging URLs

- **Symptom:** `wedding-backend is unhealthy`; frontend blocked (depends on healthy backend).
- **Root cause:** `app/config.py::validate_for_startup()` requires non-empty `API_URL` and
  `FRONTEND_URL` (and `DEBUG=false`) whenever `ENVIRONMENT` is `staging` or `production`. The initial
  test env left them empty.
- **Fix:** Set `API_URL`, `FRONTEND_URL`, `CORS_ORIGINS_RAW`, `DEBUG=false` in `.env.test`.
- **Verification:** Backend reached `healthy`; `/health` → 200; full stack up.
- **PRODUCTION IMPLICATION:** `API_URL`/`FRONTEND_URL` are REQUIRED secrets/config for any non-dev
  deploy and must be present in the GitHub Actions secret set (Agent 6) and `.env.docker`. In
  production they must additionally be HTTPS, and CORS origins must NOT contain localhost.

## Issue 5 (observed, transient) — postgres FATAL on first boot

- **Symptom:** `FATAL: database "wedding_dev" does not exist` once at 17:46:30 UTC.
- **Root cause:** During the FIRST (failed) backend boot, the backend connected before `initdb`
  finished creating the database. The compose health-gate normally prevents this, but the backend
  crashed on config validation (Issue 4) and was restarted by compose during the initdb window.
- **Resolution:** Self-resolved once initdb completed (DB ready 17:46:31). After the config fix the
  health gate worked as designed. All 14 tables present and queryable. No recurrence.

## Issue 6 — Playwright browser E2E suite: 49/88 failing

- **Symptom:** `npx playwright test` → 37 passed / 49 failed / 2 skipped (exit 1). Fails in
  `guest-management`, `invite-management`, `navigation` (both browser projects).
- **Root cause:** Stale tests vs. current backend. The specs mock only some `/api/*` routes
  (`/api/guests`, `/api/invites`); the app also makes OTHER unmocked API calls. Those fall through
  the test Vite server's proxy (`/api → http://127.0.0.1:3001`) to the LIVE FastAPI, which now
  returns `401 Unauthorized` due to the auth walls added in `9be1c4f`. Each spec's `beforeEach`
  registers a console listener and the teardown asserts `expect(unexpectedErrors).toEqual([])`; the
  401 "Failed to load resource" console errors break it, and primary assertions fail because the
  unmocked data never loads.
- **Status:** NOT fixed by Agent 7 — this is frontend test maintenance, out of scope for the
  deployment task, and does not affect the (healthy) containerized stack. Logged as a production
  blocker for the frontend/test owner.
- **Fix direction:** add `page.route` mocks for the auth/session endpoints (e.g. `/api/auth/me`) in
  the affected specs, OR run the suite fully hermetically with no proxy fallthrough (abort unmocked
  `/api/*`), OR relax the console-error assertion to ignore 401s on unmocked routes.
- **Verification of root cause:** isolated re-run of `guest-management.spec.ts:144` showed
  `Received + ["Failed to load resource: ... 401 (Unauthorized)", ...]` against `expected []`.

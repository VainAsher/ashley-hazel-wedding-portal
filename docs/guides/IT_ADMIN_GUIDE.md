# IT / Admin Guide — Ashley & Hazel Wedding Portal

Operating, deploying, and maintaining the portal. Pairs with
**`docs/ARCHITECTURE.md`** (how it's built) and **`docs/ci/PRODUCTION_RUNBOOK.md`**
(the full go-live procedure). This guide is the day-to-day ops reference.

## At a glance
- **App:** React + Vite SPA (served by nginx) → FastAPI (Python) → PostgreSQL 16, all in Docker.
- **Repo:** `github.com/VainAsher/ashley-hazel-wedding-portal` (branch `main`). Live since **v1.0.0** (2026-06-26); current **v1.1.0-rc1**.
- **Public URL:** `https://ashley-and.hazel-of-halifax.com` (TLS at the Cloudflare edge).

## Homelab topology
| Piece | Where |
|-------|-------|
| **Production app** | wedding VM **`192.168.0.32`** (`deploy@`), Docker project **`wedding-prod`** |
| **Staging app** | same VM `.32`, default project (synthetic data; auto-deploys) |
| **Edge** | infra-core **`.23`** — Cloudflared tunnel `f0b1403c-…` → **Traefik** (`:443`) |
| **CI runner** | self-hosted runner on **`.41`** |
| **Backups** | PBS (VM snapshots) now; NAS `.176` for DB dumps later |

**Request path:** browser → Cloudflare (TLS) → cloudflared (`.23`) → Traefik (`.23`,
file route `app-wedding.yml`) → `http://192.168.0.32:8090` → nginx → FastAPI.

**Isolation:** prod runs as a separate Compose project with its own containers
(`wedding-prod-*`), volumes (`wedding-prod-pgdata` / `-uploads` / `-backend-logs`),
network, DB (`wedding_prod`), and secrets. A staging deploy **cannot** touch prod data.

## Environments & promotion
- **dev** (local) → **staging** (`.32`, auto-deploys on green Tests, `stage-ashley-and…`)
  → **production** (`.32`, **manual + reviewer-gated**, `ashley-and…`).
- **Push to `main`** → GitHub **Tests** run → on green, **auto-deploy to staging only**.
- **Production deploy is manual:** Actions → **Deploy** → Run workflow →
  environment `production`, action `deploy` → **approve the review gate** (required
  reviewer). It never deploys automatically.

## Deploying to production (recap)
1. Code is on `main`, Tests green.
2. Trigger the Deploy workflow for `production` / `deploy`; approve.
3. The runner SSHes to `.32`, checks out the revision into `/home/deploy/wedding-prod`,
   builds SHA-tagged images, brings up the `wedding-prod` stack (health-gated),
   reconciles the DB password, applies SQL migrations, and records rollback tags.
4. **Rollback:** same workflow with action `rollback` (re-ups the previous image tag),
   or on the host: `DEPLOY_ENVIRONMENT=production bash production/scripts/deploy.sh`
   with the rollback action. Data volumes are preserved across deploys.

Secrets/config live in the GitHub **`production` Environment** (POSTGRES_PASSWORD,
JWT_SECRET, API_KEY_SECRET, SESSION_SECRET_KEY, `vars.DEPLOY_PATH=/home/deploy/wedding-prod`).
Non-secret prod values (DB name `wedding_prod`, the `https` URLs, port 8090) are baked
into `docker-compose.prod.yml` / `deploy.sh`.

## Common operations (run from a workstation with SSH to `.32`)
```bash
# Health (public, end-to-end)
curl -I https://ashley-and.hazel-of-halifax.com/healthz          # nginx -> 200
curl    https://ashley-and.hazel-of-halifax.com/api/auth/me      # backend -> 401 JSON (= reachable)

# Container status / logs
ssh deploy@192.168.0.32 'docker ps | grep wedding-prod'
ssh deploy@192.168.0.32 'docker logs --tail 50 wedding-prod-backend'

# Database shell (local-socket trust; no password)
ssh deploy@192.168.0.32 'docker exec -it wedding-prod-postgresql psql -U wedding -d wedding_prod'

# Internal readiness (DB-touching)
ssh deploy@192.168.0.32 'docker exec wedding-prod-backend python -c "import urllib.request as u;print(u.urlopen(\"http://localhost:3001/health/ready\").read())"'
```

## Backups & restore
- **VM-level:** PBS snapshots the whole VM (recovery path already exists).
- **Database (logical):** `production/scripts/backup.sh` runs `pg_dump` of `wedding_prod`,
  gzips to `/home/deploy/wedding-prod-backups`, keeps 14 days, optional offsite to NAS.
  **Schedule it** (cron on `.32`):
  ```
  0 3 * * * cd /home/deploy/wedding-prod/production && bash scripts/backup.sh >> /home/deploy/wedding-prod-backups/backup.log 2>&1
  ```
- **Restore drill:** `production/scripts/restore.sh <dump.sql.gz>` restores into a
  throwaway DB (`wedding_restore_test`) — prove backups work without touching live.

## Bulk data loads (no UI importer yet)
There's no CSV import in the app, so bulk guest/photo loads are done directly:
- **Guests:** `INSERT INTO guests …` via `docker exec … psql` (validates against the
  `name`/email/RSVP constraints).
- **Gallery:** copy image files into `wedding-prod-backend:/app/uploads/1/` and insert
  `gallery_items` rows (`file_path='1/<name>.jpg'`, `content_type='image/jpeg'`,
  `status='approved'`). Gallery is **image-only**. (This is how the launch data was loaded.)

> The app's APIs require an authenticated session (an invite code), so scripted/bulk
> work is done at the DB/volume layer rather than via the API.

## Monitoring & security
- **Metrics:** Prometheus at `/metrics` (internal only in prod). **Errors:** Sentry,
  optional (off unless `SENTRY_DSN` set — and it must be a valid HTTPS DSN, or the
  backend refuses to start).
- **Login protection:** Cloudflare WAF rate-limit rule on `/api/auth/login`.
- **Hardening:** prod runs `DEBUG=false`, secure (HTTPS-only) session cookies, closed
  DB/backend host ports, security headers, `restart: always`.

## Phase note (data state)
The wedding lifecycle is `planning → live → event → archived` (Settings). Production is
currently **`live`** (guest RSVP + Dancefloor song requests open). Migration `008`
(demo seed) is fenced out of prod, so production never carries demo data.

**Adding a migration?** Numbered SQL in `production/database/migrations/` is applied
automatically by `deploy.sh`, but CI initialises its test DBs from an **explicit list**
— add the new file to BOTH psql lists in `.github/workflows/test.yml` or CI fails.

## Troubleshooting
- **Backend crash-loops / frontend down:** check `docker logs wedding-prod-backend` —
  usually a config validation failure (e.g. a bad `SENTRY_DSN`, or `wedding_prod` DB
  missing because the volume was initialised under a different name). See the
  `PRODUCTION_RUNBOOK.md` "Pre-deploy verification" and `TROUBLESHOOTING_GUIDE.md`.
- **DB-backed routes 500 after a secret rotation:** the role password drifted from the
  `DATABASE_URL` secret — `deploy.sh` reconciles it on deploy; or `ALTER USER wedding
  WITH PASSWORD '<secret>'` then restart the backend.
- **Site 502:** the app stack is down or the Traefik/cloudflared route is off — check
  `docker ps` on `.32` and the route file / tunnel on `.23`.

## Where things live
- Plan & runbook: `docs/ci/PRODUCTION_RUNBOOK.md`, `docs/ci/*`
- Architecture: `docs/ARCHITECTURE.md`
- Deploy script: `production/scripts/deploy.sh` · Backups: `production/scripts/backup.sh` / `restore.sh`
- Bootstrap: `production/backend/scripts/bootstrap_prod.py`
- Feedback/backlog for the next update: `docs/FEEDBACK_BACKLOG.md`

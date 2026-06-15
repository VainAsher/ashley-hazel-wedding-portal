# Agent 4 — docker-compose Orchestration: Implementation Log

Assembles the three-service stack (PostgreSQL, FastAPI backend, Nginx frontend)
into a single, health-gated docker-compose deployment.

## Deliverables

| File | Purpose |
|------|---------|
| `production/docker-compose.yml` | Staging / base orchestration (all three services) |
| `production/docker-compose.prod.yml` | Production override (closes ports, hardens runtime) |
| `production/.env.docker` | Secret/config template (copy to `.env`) |
| `production/AGENT4_IMPLEMENTATION_LOG.md` | This document |
| `production/AGENT5_HANDOVER.md` | deploy.sh orchestration spec for Agent 5 |

All files validated with `docker compose config` (real schema + merge resolution),
Compose **v5.1.4**. Both base and merged (prod) configs parse cleanly.

---

## 1. Service Topology

```
            host :80 ──► frontend (nginx :8080)
                              │  proxy /api/ ──► backend:3001
                              ▼
   host :3001 (staging) ──► backend (uvicorn :3001)
                              │  DATABASE_URL ──► postgresql:5432
                              ▼
   host :5432 (staging) ──► postgresql (:5432)  [pgdata volume]
```

- **postgresql** `postgres:16-alpine` — durable store on the `pgdata` volume.
  `schema.sql` mounted read-only into `/docker-entrypoint-initdb.d/` so the
  canonical schema applies automatically on first boot.
- **backend** `wedding-backend:${IMAGE_TAG:-latest}` — FastAPI/uvicorn on 3001,
  built from `./backend/Dockerfile` (multi-stage, non-root uid 10001).
- **frontend** `wedding-frontend:${IMAGE_TAG:-latest}` — nginx-unprivileged on
  8080, built from `./frontend/Dockerfile`. Serves the built SPA and reverse-
  proxies `/api/` → `backend:3001` (config baked into `nginx.conf`).

## 2. Network Architecture

Single user-defined bridge network **`wedding`**. Services resolve each other by
service name via Docker's embedded DNS:
- backend reaches the DB at `postgresql:5432`
- nginx upstream is `server backend:3001;` (see `nginx.conf`)

No host port publishing is required for inter-service traffic; published ports
exist only for human access (staging) and are removed in production.

## 3. Volume Strategy

| Volume | Mount | Role |
|--------|-------|------|
| `wedding-pgdata` | `postgresql:/var/lib/postgresql/data` | **Durable** DB files; survives `up`/`down`, removed only by `down -v`. |
| `wedding-backend-logs` | `backend:/app/logs` | FastAPI rotating logs (`LOG_FILE_PATH=logs/app.log`); the backend image pre-creates `/app/logs` owned by `appuser`. |

The `pgdata` volume also governs schema init: `/docker-entrypoint-initdb.d/`
scripts run **only when the data dir is empty** (first boot). `schema.sql` uses
bare `CREATE TYPE`/`CREATE TABLE` (no `IF NOT EXISTS`), so once-only execution is
exactly correct. To re-apply schema, `docker compose down -v` to drop `pgdata`.
Incremental migrations under `database/migrations/` are NOT auto-applied —
Agent 5's deploy.sh runs them against a running DB (see handover).

## 4. Environment Variable Injection

All config is injected at runtime via `${VAR}` interpolation from `.env`
(compose auto-loads it) or the CI environment. Nothing secret is in any image.

- **Built DATABASE_URL**: compose composes it from parts —
  `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgresql:5432/${POSTGRES_DB}`
  so the password lives in exactly one place.
- **Required secrets** use the fail-fast guard `${VAR:?message}` — compose
  refuses to start if `POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY_SECRET`, or
  `SESSION_SECRET_KEY` are unset (verified).
- The backend config is pydantic-settings with `extra="ignore"`, so the full
  env set is accepted; only recognized keys are used.

**Alignment correction vs. brief:** the brief showed `LOG_LEVEL: WARN` for
production. The backend's `Settings.normalize_log_level` validator only accepts
`DEBUG/INFO/WARNING/ERROR/CRITICAL` — `WARN` would raise at startup. Production
override therefore uses **`WARNING`**. Also added `SESSION_SECRET_KEY` (required
by the config) and `SESSION_COOKIE_SECURE`, which the original brief omitted.

## 5. Health Check Design

| Service | Probe | Why |
|---------|-------|-----|
| postgresql | `pg_isready -U $USER -d $DB` | "healthy" means *accepts connections as the app user*, not merely "process up". Ships in the postgres image. |
| backend | `python -c "...urllib.request.urlopen('http://localhost:3001/health')..."` | The `python:3.12-slim` runtime has **no curl**. Uses stdlib only, matching the image's own Dockerfile HEALTHCHECK. Hits the DB-free `/health` (returns static JSON). |
| frontend | `wget -q --spider http://localhost:8080/healthz` | busybox `wget` ships in nginx-alpine; `/healthz` is a static `return 200` in nginx.conf — no backend dependency. |

**Correction vs. brief:** the brief's backend check was `curl -f ...`. curl is
absent from the slim image, so that check would always fail and the container
would never become healthy → frontend would never start. Replaced with the
stdlib Python probe.

## 6. Startup Ordering (gated)

`depends_on` with `condition: service_healthy` (Compose v3+) enforces:

```
postgresql healthy ──► backend starts ──► backend healthy ──► frontend starts
```

This prevents the backend from racing an unready DB and prevents nginx from
proxying to a backend that isn't up. `restart: unless-stopped` (staging) /
`always` (prod) recovers transient failures.

## 7. Port Mapping Strategy

| Service | Staging (base) | Production (override) |
|---------|----------------|------------------------|
| postgresql | `5432:5432` (host psql/debug) | none (`!reset []`) |
| backend | `3001:3001` (direct API testing) | none (`!reset []`) |
| frontend | `${FRONTEND_HOST_PORT:-80}:8080` | none — Traefik fronts `:8080` |

**Compose merge gotcha (found & fixed):** a plain `ports: []` override does
**not** clear the base file's host mappings — Compose merges short-form port
lists, so the host ports leaked into the merged production config (verified: 80,
3001, 5432 still published). The fix is the `!reset []` YAML tag (Compose
v2.24+), which forces the merged value to empty. Verified: merged prod config
has **zero** `published:` ports.

## 8. Development vs. Production

| Aspect | Staging (`docker-compose.yml`) | Production (`+ docker-compose.prod.yml`) |
|--------|-------------------------------|------------------------------------------|
| Host ports | db/backend/frontend all published | none (network-internal + Traefik) |
| `ENVIRONMENT` | `staging` | `production` |
| `LOG_LEVEL` | `INFO` | `WARNING` |
| `SESSION_COOKIE_SECURE` | `false` | `true` (HTTPS via Traefik) |
| `restart` | `unless-stopped` | `always` |
| Edge TLS | none | Traefik (labels stubbed in override) |

## 9. Using docker-compose

Run from `production/` with a populated `.env` (`cp .env.docker .env`).

```bash
# Build images
docker compose build

# Staging up (detached)
docker compose up -d

# Production up (layer the override)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Status / health
docker compose ps

# Logs (follow one service)
docker compose logs -f backend

# Stop (keep data)              # Stop + wipe volumes (drops the DB!)
docker compose down             docker compose down -v

# Validate config without running
docker compose config
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
```

## 10. Integration with deploy.sh (Agent 5)

The existing `production/scripts/deploy.sh` is a **bare-metal** flow (uvicorn via
PID files, `BACKEND_HEALTH_URL=.../api/guests`). Agent 5 must add a
docker-compose deploy path: build → down → up → `ps` → health-poll, with image
tagging for rollback and migrations applied against the running DB. Full spec in
`AGENT5_HANDOVER.md`.

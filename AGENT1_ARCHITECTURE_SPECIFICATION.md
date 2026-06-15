# AGENT 1 — DOCKER ARCHITECTURE SPECIFICATION
## Wedding Portal Staging Environment Containerization

**Author:** Agent 1 (Planning & Architecture)
**Date:** 2026-06-15
**Target host:** 192.168.0.32 (staging)
**Staging domain:** stage-ashley-and.hazel-of-halifax.com
**Production domain:** ashley-and.hazel-of-halifax.com (deployed via client-hosting .40)
**Status:** SPECIFICATION ONLY — no production code in this document set.

---

## 0. Executive Summary

The wedding portal today runs as three loose processes on a single host:

| Service | Current runtime | Port |
|---|---|---|
| Frontend | Vite **dev server** (`npm run dev`) | 3000 |
| Backend | FastAPI via `python main.py` (uvicorn) in a venv | 3001 |
| Database | PostgreSQL 16 (`wedding_dev`) | 5432 |

The goal is to containerize all three into **separate, independently-buildable Docker images** orchestrated by a single `docker-compose.yml`, with a private bridge network, persistent named volumes, externally-injected secrets, health-check-gated startup ordering, and a clear rollback path.

This document is the master architecture reference. Two companion documents carry the implementation detail:
- `AGENT1_DOCKERFILE_SPECS.md` — exact Dockerfile specs for backend (Agent 2) and frontend (Agent 3).
- `AGENT2_HANDOVER.md` — line-by-line backend Dockerfile, test plan, success criteria.

---

## 1. Ground-Truth Findings (from the actual codebase)

These findings are **load-bearing**. The architecture below is built around them, not around assumptions.

### 1.1 An existing backend Dockerfile already exists — and it is broken

`production/backend/Dockerfile` exists and is a multi-stage build, but it has **three defects** that Agent 2 MUST fix:

1. **Broken health check.** The `HEALTHCHECK` runs:
   ```
   CMD python -c "import requests; requests.get('http://localhost:3001/health')"
   ```
   `requests` is **NOT** in `requirements.txt` (which has `httpx`, not `requests`). This health check will raise `ModuleNotFoundError` on every probe, so the container reports `unhealthy` forever and `depends_on: condition: service_healthy` will never release. **Use `httpx` (already a dependency) or `urllib` (stdlib).**

2. **No non-root user.** The image installs to `/root/.local` and runs as root. The task and Docker best practice require a non-root runtime user. Reworking to a non-root user also means `--user` install paths must move out of `/root`.

3. **`COPY . .` with a thin `.dockerignore`.** Current `.dockerignore` excludes caches, `.env*`, `.git`, `logs`, and venvs (good), but `COPY . .` still copies `docs/`, `tests/`, `scripts/`, `.pytest_cache` parent artifacts, etc. Acceptable but not minimal; tighten as noted in the Dockerfile spec.

### 1.2 The DB engine is created at import time → backend crashes if DB is not ready

`app/db/database.py` calls `create_engine(...)` at **module import time** (line 12), and `app/main.py` imports the API routers which import the DB layer. SQLAlchemy `create_engine` is lazy about *connecting*, so import itself won't open a socket — **but** `app/main.py` line 19 calls `settings.validate_for_startup()` at import, and the first real request will hit the DB. More importantly, `app/db/__init__` / model import chains and any startup query will fail hard if Postgres is unreachable.

**Architectural consequence:** the backend container MUST NOT be considered "started" until Postgres is healthy. We enforce this with `depends_on: { postgres: { condition: service_healthy } }` plus a backend application-level health check, plus `restart: unless-stopped` so a backend that loses the DB recovers automatically.

### 1.3 Backend config is strict and secret-aware — secrets MUST be injected, never baked

`app/config.py` `environment_errors()` (lines 110–165) **rejects**, for staging/production:
- `DEBUG=true`
- missing `API_URL` / `FRONTEND_URL`
- any of `JWT_SECRET`, `API_KEY_SECRET`, `SESSION_SECRET_KEY` that are `< 16` chars **or** contain `replace-with`, `dev-`, or `change-in-production`.

The committed `.env.staging` and `.env.production` deliberately contain placeholder values (`replace-with-staging-jwt-secret`, etc.). **The app will refuse to boot** with these placeholders. Therefore:
- **No `.env.staging`/`.env.production` may be copied into any image** (already excluded in `.dockerignore`, keep it that way).
- Real secret values are injected at **runtime** via Docker Compose `env_file` / `environment`, sourced from an **untracked** `.env` file on the host (192.168.0.32) or GitHub Actions secrets.

### 1.4 The entrypoint runs uvicorn with `app, host, port` from settings

`main.py` (compat entrypoint) runs `uvicorn.run(app, host=settings.app_host, port=settings.app_port)` — i.e. host `0.0.0.0`, port `3001` from `.env`. The container `CMD` can keep `python main.py`, but a production-grade uvicorn invocation (`uvicorn app.main:app --host 0.0.0.0 --port 3001`) is preferred and discussed in the Dockerfile spec.

### 1.5 Frontend is a Vite **dev** server with a hardcoded API proxy

`vite.config.ts`: dev server on `0.0.0.0:3000`, proxies `/api` → `http://127.0.0.1:3001`. A `dist/` build output already exists and `package.json` has `build` + `preview` scripts.

**Architectural consequence:** in a container, `127.0.0.1:3001` is the *frontend container's* loopback, not the backend. Two valid options:
- **Option A (RECOMMENDED): static build served by nginx.** `npm run build` → `dist/`, served by nginx. nginx also reverse-proxies `/api` → `http://backend:3001`. This is production-shaped, smallest runtime, and removes Node from the runtime image entirely.
- **Option B: `vite preview`.** Serves `dist/` over Node but has no built-in `/api` proxy in preview mode → would require app-level base URL config. Rejected for staging in favor of Option A.

The frontend Dockerfile spec (in `AGENT1_DOCKERFILE_SPECS.md`) is built around **Option A**.

### 1.6 Migrations are plain SQL files applied by `psql`

`production/database/migrations/00X_*.sql` (002–008) plus `schema.sql`, `seed_test_data.sql`. The legacy `deploy.sh` applies them via `psql "$DATABASE_URL" -f`. In the container model, schema/seed are applied via a **one-shot migration job** (a profile-gated compose service) OR via Postgres's `/docker-entrypoint-initdb.d` on first-boot of an empty volume. We standardize on a dedicated **`migrate` one-shot service** so migrations are re-runnable on an existing volume (init scripts only run on an empty data dir).

### 1.7 Domain name discrepancy — FLAG FOR HUMAN

The task specifies `stage-ashley-and.hazel-of-halifax.com` / `ashley-and.hazel-of-halifax.com`. The committed `.env.staging`/`.env.production` use `staging.ashley-hazel-wedding.example` / `ashley-hazel-wedding.example`. **These do not match.** Agent 4 (compose) and whoever owns DNS/TLS must reconcile `API_URL`, `FRONTEND_URL`, `CORS_ORIGINS_*` with the real domains before staging traffic is served. Recorded here as a known open item; not blocking for image builds.

---

## 2. Target Architecture

### 2.1 Service inventory (containerized)

| Container | Image base | Build | Runtime port (internal) | Published on host | Volumes |
|---|---|---|---|---|---|
| `postgres` | `postgres:16-alpine` | none (official) | 5432 | 5432 (bind `127.0.0.1` only) | `pgdata` (data), init scripts (ro) |
| `backend` | `python:3.12-slim` (multi-stage) | yes | 3001 | none (proxied) | `backend_logs` (logs) |
| `frontend` | `nginx:1.27-alpine` (multi-stage build w/ `node:20-alpine`) | yes | 8080 (nginx) | 80 / 443 (or behind host reverse proxy) | nginx conf (ro) |
| `migrate` (one-shot, profile `migrate`) | `postgres:16-alpine` (for `psql`) | none | n/a | n/a | migrations (ro) |

> Port note: we intentionally do **not** publish backend `3001` or Postgres `5432` to `0.0.0.0`. Postgres is bound to `127.0.0.1:5432` on the host for admin access only; the backend is reachable only inside the `wedding` network and via the frontend's nginx `/api` proxy. This shrinks the attack surface on 192.168.0.32.

### 2.2 Network topology

```
                         host 192.168.0.32
   ┌───────────────────────────────────────────────────────────────┐
   │                                                                 │
   │   :80/:443  ──────────────►  frontend (nginx:8080)              │
   │                                  │                              │
   │                                  │  proxy_pass /api/            │
   │                                  ▼                              │
   │             docker network: wedding (bridge, internal DNS)      │
   │   ┌──────────────────────────────────────────────────────┐     │
   │   │   frontend ──/api──► backend:3001 ──► postgres:5432    │     │
   │   │                         ▲                              │     │
   │   │      migrate (one-shot) ┘ (psql → postgres:5432)       │     │
   │   └──────────────────────────────────────────────────────┘     │
   │                                                                 │
   │   127.0.0.1:5432 ──► postgres  (admin-only host binding)        │
   └───────────────────────────────────────────────────────────────┘
```

- **Single user-defined bridge network: `wedding`.** Docker's embedded DNS lets containers resolve each other by **service name** (`postgres`, `backend`, `frontend`). This is why the backend's `DATABASE_URL` host becomes `postgres` (not `localhost`/`192.168.0.32`), and nginx proxies to `http://backend:3001`.
- No `links`, no host networking, no `network_mode: host`. User-defined bridge only.
- Only the frontend publishes ports to the outside world. Optionally, a host-level reverse proxy / TLS terminator (Caddy/nginx/Traefik on .32 or the client-hosting box) sits in front for `stage-ashley-and.hazel-of-halifax.com`.

### 2.3 DNS / service-name contract (the wiring that must be consistent)

| Consumer | Setting | Value in container world |
|---|---|---|
| backend | `DATABASE_URL` | `postgresql://wedding:<pw>@postgres:5432/wedding_dev` |
| migrate | `DATABASE_URL` | same as above |
| frontend nginx | `proxy_pass` for `/api/` | `http://backend:3001/` |
| backend | `APP_HOST` / `APP_PORT` | `0.0.0.0` / `3001` |
| backend | `CORS_ORIGINS_RAW` | must include the staging origin served by the frontend |

### 2.4 Volume strategy

| Volume | Type | Mounted in | Purpose | Backup? |
|---|---|---|---|---|
| `pgdata` | named volume | `postgres:/var/lib/postgresql/data` | **Durable DB storage.** Survives container recreation; this is the single source of truth for guest/RSVP/task data. | YES — nightly `pg_dump`, see §6 |
| `backend_logs` | named volume (or bind) | `backend:/app/logs` | App log files (`logs/app.log` + rotation). `LOG_FILE_PATH=logs/app.log`. | optional |
| DB init scripts | bind, read-only | `postgres:/docker-entrypoint-initdb.d:ro` and/or `migrate:/migrations:ro` | `schema.sql` + ordered `migrations/*.sql` (+ seed for staging). | n/a (in git) |
| nginx config | bind, read-only | `frontend:/etc/nginx/conf.d/default.conf:ro` | reverse-proxy + SPA fallback config | n/a (in git) |

**Rules:**
- Named volumes (not bind mounts) for `pgdata` so Docker manages lifecycle and it is portable to the .40 production box. Never `rm -v` it without a verified backup.
- Logs may be a named volume **or** a host bind mount (`/home/deploy/wedding-dashboard/logs`) so ops can `tail` them without `docker exec`. Recommend host bind for staging observability.
- Read-only (`:ro`) for everything the container should never write (configs, migrations).

### 2.5 Environment-variable injection strategy

**Principle: images are secret-free; configuration is injected at runtime.**

Layered, in increasing precedence:
1. **Image defaults** — none for secrets. The Dockerfile sets only non-sensitive `ENV` (e.g. `PYTHONUNBUFFERED=1`, `PATH`). No `.env*` files are ever `COPY`'d in (enforced by `.dockerignore`).
2. **Compose `env_file`** — each service references a host file, e.g. `env_file: ./secrets/backend.staging.env`. This file is **git-ignored** and lives only on 192.168.0.32. It is the materialized, real-secret version of `.env.staging` (placeholders replaced).
3. **Compose `environment:`** — for a small number of non-secret overrides and service-name wiring (`DATABASE_URL` host = `postgres`).
4. **CI/CD injection** — GitHub Actions writes `secrets/backend.staging.env` on the runner/host from repository/environment secrets (`JWT_SECRET`, `API_KEY_SECRET`, `SESSION_SECRET_KEY`, `DATABASE_URL`, `SENTRY_DSN`) immediately before `docker compose up`, then shreds it.

**Required backend secrets (must be real, 16+ chars, no placeholder tokens):**
`JWT_SECRET`, `API_KEY_SECRET`, `SESSION_SECRET_KEY`, plus DB credentials inside `DATABASE_URL`. `SENTRY_DSN` optional (must be valid HTTPS DSN if set).

**Postgres secrets:** `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — injected from the same host secret file; `DATABASE_URL` in the backend file must be kept consistent with them.

### 2.6 Health checks

| Service | Probe | Why |
|---|---|---|
| `postgres` | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` | True readiness (accepting connections), gates backend + migrate startup. `interval 5s / timeout 5s / retries 5 / start_period 10s`. |
| `backend` | `httpx`/`urllib` GET `http://localhost:3001/health` expecting 200 | App is up and `validate_for_startup()` passed. Gates frontend (so nginx never proxies to a dead upstream during boot). `interval 10s / timeout 5s / retries 3 / start_period 20s`. |
| `frontend` | `wget -qO- http://localhost:8080/` (or nginx `/healthz` location) | nginx serving the SPA. `interval 10s / timeout 5s / retries 3`. |
| `migrate` | n/a (one-shot, exits 0 on success) | Not a long-running service. |

> The `/health` endpoint already exists in `app/main.py` (line 79) and returns `{"status":"healthy"}` with 200. The backend health check MUST hit `/health`, not `/api/guests` (the legacy `deploy.sh` used `/api/guests`, which touches the DB — fine as a smoke test but too heavy/coupled for a liveness probe).

### 2.7 Startup order & dependencies

```
postgres (healthy)
   └─► migrate (runs migrations, exits 0)        [profile: migrate / run once per deploy]
   └─► backend (depends_on postgres: service_healthy; restart: unless-stopped)
          └─► frontend (depends_on backend: service_healthy)
```

- `backend.depends_on.postgres.condition = service_healthy` — solves §1.2 (no boot before DB ready).
- `frontend.depends_on.backend.condition = service_healthy` — nginx upstream is alive before traffic.
- `migrate` is a separate one-shot service in a **compose profile** so a normal `docker compose up` doesn't re-run it implicitly; the deploy pipeline runs `docker compose run --rm migrate` explicitly, before bringing up backend. (Alternatively `--profile migrate up` then the job exits.)
- **Restart policies:** `postgres` and `backend` → `unless-stopped`; `frontend` → `unless-stopped`; `migrate` → `no` (`restart: "no"`).

---

## 3. Image Build Strategy (summary; full detail in DOCKERFILE_SPECS)

### 3.1 Backend — multi-stage, non-root, slim
- **Stage 1 `builder`** (`python:3.12-slim`): install build deps (`gcc`, headers needed by `psycopg2-binary` — usually none since it's a wheel, but keep `gcc` defensive), `pip install --prefix=/install -r requirements.txt`.
- **Stage 2 `runtime`** (`python:3.12-slim`): create non-root user `appuser`, install **runtime-only** `postgresql-client` (needed if we ever shell migrations from backend; optional), copy `/install` from builder into the system prefix, copy app source, run as `appuser`, `EXPOSE 3001`, fixed `httpx`/`urllib`-based `HEALTHCHECK`, `CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","3001"]` (or `python main.py`).
- Pin base image by digest in production hardening pass (note for later).

### 3.2 Frontend — multi-stage build → nginx static
- **Stage 1 `build`** (`node:20-alpine`): `npm ci`, `npm run build` → `/app/dist`.
- **Stage 2 `serve`** (`nginx:1.27-alpine`): copy `dist/` into `/usr/share/nginx/html`, copy custom nginx conf (SPA `try_files` fallback + `/api/` reverse proxy to `backend:3001`), `EXPOSE 8080`, run nginx (non-root nginx variant or adjust perms).
- Build-time `VITE_*` vars (if the app reads any API base URL) are injected as `--build-arg` / `ARG`; with the nginx `/api` proxy approach the app can simply call same-origin `/api/...`, avoiding baked-in absolute URLs.

### 3.3 Postgres — official image, no custom build
- `postgres:16-alpine`, `pgdata` volume, init scripts mounted read-only. Custom build only if extensions are needed (none today).

---

## 4. docker-compose.yml Structure (spec for Agent 4)

Target Compose spec version: **Compose v2** (no top-level `version:` key required). Filename: `production/docker-compose.staging.yml` (a `docker-compose.yml` base + `docker-compose.staging.yml` override is also acceptable).

```
services:
  postgres:
    image: postgres:16-alpine
    env_file: [ ./secrets/postgres.staging.env ]   # POSTGRES_USER/PASSWORD/DB
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ../production/database/schema.sql:/docker-entrypoint-initdb.d/00_schema.sql:ro   # optional first-boot
    ports:
      - "127.0.0.1:5432:5432"      # admin-only, loopback
    healthcheck: pg_isready ...
    restart: unless-stopped
    networks: [ wedding ]

  migrate:
    image: postgres:16-alpine       # for psql
    profiles: [ "migrate" ]
    env_file: [ ./secrets/backend.staging.env ]     # DATABASE_URL
    volumes:
      - ../production/database:/migrations:ro
    entrypoint: [ "sh","-c" ]
    command: [ "for f in /migrations/migrations/0*.sql; do psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -f \"$f\"; done" ]
    depends_on: { postgres: { condition: service_healthy } }
    restart: "no"
    networks: [ wedding ]

  backend:
    build: { context: ../production/backend, dockerfile: Dockerfile }
    image: wedding-backend:staging
    env_file: [ ./secrets/backend.staging.env ]
    environment:
      - ENVIRONMENT=staging
      - APP_HOST=0.0.0.0
      - APP_PORT=3001
      # DATABASE_URL host MUST be 'postgres'
    volumes:
      - backend_logs:/app/logs
    depends_on: { postgres: { condition: service_healthy } }
    healthcheck: GET /health
    restart: unless-stopped
    networks: [ wedding ]
    # NOTE: no 'ports:' — backend is internal-only

  frontend:
    build:
      context: ../production/frontend
      dockerfile: Dockerfile
      args: []     # VITE_* build args if needed
    image: wedding-frontend:staging
    volumes:
      - ../production/frontend/nginx.staging.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "80:8080"           # (and 443 if TLS terminated here)
    depends_on: { backend: { condition: service_healthy } }
    healthcheck: wget /healthz
    restart: unless-stopped
    networks: [ wedding ]

volumes:
  pgdata:
  backend_logs:

networks:
  wedding:
    driver: bridge
```

(Exact values, secret-file names, TLS handling, and the migrate command quoting are Agent 4's to finalize. The structure, dependency conditions, network, and "no published backend port" decisions are fixed by this spec.)

---

## 5. Deployment Flow

### 5.1 CI/CD trigger → orchestrated startup

```
 developer push / merge to main
            │
            ▼
   GitHub Actions (deploy-staging workflow)
            │  1. checkout
            │  2. build images:  docker compose -f docker-compose.staging.yml build
            │  3. (optional) push images to registry  OR build on host via SSH
            │  4. SSH to 192.168.0.32 / run on host:
            │       a. materialize ./secrets/*.staging.env from GH secrets
            │       b. docker compose pull (if registry) or build
            │       c. docker compose up -d postgres        # wait healthy
            │       d. docker compose run --rm migrate       # apply SQL migrations
            │       e. docker compose up -d backend frontend # gated by healthchecks
            │       f. post-deploy smoke test: curl https://stage.../api/guests + /health
            │       g. shred ./secrets/*.staging.env
            ▼
   Services live on 192.168.0.32  (frontend :80/:443 → backend:3001 → postgres:5432)
```

### 5.2 Service communication at runtime

- Browser → `https://stage-ashley-and.hazel-of-halifax.com` → frontend nginx (static SPA).
- SPA calls same-origin `/api/...` → nginx `proxy_pass http://backend:3001/` → FastAPI.
- FastAPI → `postgresql://...@postgres:5432/wedding_dev` (SQLAlchemy pool: size 10, overflow 20 from `.env`).
- All inter-service traffic stays on the `wedding` bridge; only `:80/:443` is exposed.

### 5.3 Data persistence

- All writes land in Postgres → `pgdata` named volume on the host filesystem.
- Container recreation (redeploy) **does not** touch `pgdata`. `docker compose up -d --build` recreates app containers; the DB volume persists.
- Destroying data requires explicit `docker compose down -v` (must be gated behind a verified backup; see §6).

### 5.4 Rollback flow

Two independent rollback levers:

1. **Image/app rollback (fast, no data change):**
   - Tag every build immutably: `wedding-backend:staging-<gitsha>`, `wedding-frontend:staging-<gitsha>`. Keep `:staging` as a moving "current" tag.
   - To roll back: re-point compose to the previous `<gitsha>` tag (or `git checkout` previous compose) and `docker compose up -d`. Old image is still in the local image cache / registry. This is the primary rollback and is near-instant.
   - Health-check-gated: if the rolled-forward backend never goes `healthy`, the deploy script aborts and the previous container keeps running (it is only stopped once the new one is healthy, if the pipeline is written that way).

2. **Schema/data rollback (slow, deliberate):**
   - SQL migrations are forward-only in this repo (no down-migrations). Data rollback = restore from the most recent `pg_dump` (see §6) into a fresh `pgdata`.
   - **Rule:** never auto-run a destructive migration in CI without a pre-migration `pg_dump` snapshot taken in the same pipeline step.

This mirrors and supersedes the legacy `deploy.sh` rollback (which re-checked-out a git revision and restarted bare processes). The container model keeps the previous *image* available, which is more reliable than re-building from source on rollback.

---

## 6. Backups & Data Safety (operational appendix)

- **Nightly `pg_dump`** via a host cron or a `backup` profile service: `docker compose exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > /home/deploy/backups/wedding_dev_$(date).sql.gz`. Retain 14 days.
- **Pre-deploy snapshot** in the CI pipeline before `migrate`.
- `pgdata` volume must never be removed without confirming a recent dump exists.
- Restore drill documented and tested at least once before go-live (staging is the place to prove it).

---

## 7. Best-Practices Compliance Checklist

| Practice | Decision |
|---|---|
| Multi-stage builds | Backend ✅, Frontend ✅ |
| Minimal base images | `*-slim` / `*-alpine` ✅ |
| Non-root runtime user | Backend `appuser` ✅; nginx via non-root variant ✅ |
| No secrets in images | Enforced via `.dockerignore` + runtime `env_file` ✅ |
| Pinned dependency versions | `requirements.txt` pinned ✅; base image digest-pin = later hardening note |
| Health checks on every long-running service | ✅ (fix the broken backend one) |
| Explicit startup ordering | `depends_on: service_healthy` ✅ |
| Least-exposed ports | Only frontend published; Postgres loopback-only ✅ |
| Persistent named volumes for state | `pgdata`, `backend_logs` ✅ |
| Read-only mounts for configs/migrations | `:ro` ✅ |
| Reproducible, immutable image tags | `:staging-<gitsha>` ✅ |
| Defined rollback path | Image re-tag + pg_dump restore ✅ |
| Backups | Nightly + pre-deploy dump ✅ |

---

## 8. Open Items / Risks Handed Forward

1. **DOMAIN MISMATCH (high):** `.env.*` domains (`*.ashley-hazel-wedding.example`) ≠ task domains (`*-ashley-and.hazel-of-halifax.com`). Reconcile `API_URL`/`FRONTEND_URL`/`CORS_ORIGINS_RAW` before serving real traffic. → Agent 4 + human/DNS owner.
2. **Existing backend Dockerfile is buggy (high):** broken health check (`requests` not installed), runs as root. → Agent 2 must replace per `AGENT2_HANDOVER.md`.
3. **Import-time DB engine (medium):** rely on `service_healthy` ordering + `restart: unless-stopped`. Consider a lazy-engine refactor later, out of scope for containerization.
4. **TLS termination (medium):** decide whether nginx-in-frontend terminates TLS or a host/edge proxy (client-hosting .40 / Caddy) does. Affects `SESSION_COOKIE_SECURE`, HSTS, and CORS scheme.
5. **`wedding_dev` DB name (low):** task says DB is `wedding_dev`; `.env` `DATABASE_URL` paths say `/wedding`. Keep `POSTGRES_DB` and `DATABASE_URL` consistent — pick one (recommend `wedding_dev` for staging) and align both.
6. **Migrations are forward-only (medium):** no down-migrations; data rollback = restore from dump. Enforce pre-migrate snapshot.
```

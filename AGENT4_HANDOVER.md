# AGENT 4 HANDOVER — DOCKER-COMPOSE ASSEMBLY

**From:** Agent 3 (Frontend Containerization)
**To:** Agent 4 (docker-compose orchestration)
**Date:** 2026-06-15
**Read first:** `AGENT1_ARCHITECTURE_SPECIFICATION.md`, `AGENT1_DOCKERFILE_SPECS.md` (Part C), `AGENT2_HANDOVER.md`, `AGENT3_IMPLEMENTATION_LOG.md`.

Your job: write `docker-compose.yml` (staging) that wires together **postgres → (migrate) → backend → frontend** on the `wedding` network. The three images (postgres official, backend, frontend) are ready. This handover gives you the exact contracts.

---

## 1. Services to orchestrate

| Service | Image / build | Internal port | Published? | Runs as |
|---|---|---|---|---|
| `postgres` | `postgres:16-alpine` (official) | 5432 | No (internal) | postgres |
| `migrate` (optional, one-shot) | builds from `production/backend` | — | No | appuser |
| `backend` | builds from `production/backend` (Agent 2) | 3001 | **No** (internal-only) | `appuser` (uid 10001) |
| `frontend` | builds from `production/frontend` (Agent 3) | **8080** | **Yes → host 80** | `nginx` (uid 101, non-root) |

> Only the **frontend** is published. The backend is reached exclusively through nginx's `/api` reverse proxy. Postgres is internal-only.

---

## 2. FRONTEND service contract (my deliverable — authoritative)

```yaml
  frontend:
    build:
      context: ./production/frontend
      dockerfile: Dockerfile
    image: wedding-frontend:staging        # add :staging-<gitsha> per Part C
    container_name: wedding-frontend
    networks: [wedding]
    ports:
      - "80:8080"                          # host 80 -> container 8080
    depends_on:
      backend:
        condition: service_healthy         # nginx upstream needs backend live
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/healthz"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 5s
```

**Confirmed facts you can rely on:**
- **Service name:** `frontend`. **Internal port:** `8080` (non-root nginx). **Publish:** `80:8080` (the prompt mentioned `3000`; use `3000:8080` instead if staging convention prefers 3000 — either works, container side is **8080**, NOT 80).
- **Reverse proxy is built in.** nginx proxies `/api/*` → `http://backend:3001` over the `wedding` network via Docker DNS. **No extra compose wiring needed** for the proxy — it just needs `backend` resolvable on the same network.
- **`/api` prefix is preserved** end-to-end (no trailing slash on `proxy_pass`). Do **not** edit `nginx.conf` to add a trailing slash — it would 404 every API route. (FastAPI routers mount at `/api/auth`, `/api/guests`, `/api/invites`, `/api/tasks`.)
- **No frontend env vars.** The SPA is static and uses same-origin relative `/api`. There are **no `VITE_*` build args** required and **no runtime env**. If you ever need an absolute API URL (you don't), it would require a rebuild — avoid.
- **No secrets** in the frontend image. Nothing to inject.
- **Healthcheck:** `GET /healthz` → `200 "ok"` (DB-free, static). Use it for `depends_on` from anything that needs the edge up.

**Optional (per Agent 1 Part B.3):** instead of the COPY'd config you may mount the config read-only for per-env overrides:
```yaml
    volumes:
      - ./production/frontend/nginx.conf:/etc/nginx/nginx.conf:ro
```
Not required — the image already contains a correct config. If you mount, keep the same file (it targets `/etc/nginx/nginx.conf`, the full config, not `conf.d/default.conf`).

---

## 3. BACKEND service contract (from Agent 2 / Agent 1)

```yaml
  backend:
    build:
      context: ./production/backend
      dockerfile: Dockerfile
    image: wedding-backend:staging
    container_name: wedding-backend
    networks: [wedding]
    # NO ports: — internal only, reached via nginx /api proxy
    env_file: [ ./.env.staging ]           # see §5 — placeholders fail validation!
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    volumes:
      - backend_logs:/app/logs             # LOG_FILE_PATH=logs/app.log
    # healthcheck is baked into the image (urllib -> /health). Override only if needed.
```

- **Service name `backend`, port `3001`, NOT published.** This is exactly what the frontend's nginx upstream targets.
- **Health endpoint `/health`** (DB-free) — image HEALTHCHECK already hits it; `start_period=20s`.
- **MUST gate on `postgres: service_healthy`** — the SQLAlchemy engine is built at import.
- **Critical:** the committed `.env.staging` contains **placeholder** secrets that the app **rejects on startup** (config.py blocks secrets `<16` chars or containing `replace-with`/`dev-`/`change-in-production`, and requires `API_URL`/`FRONTEND_URL`, `DEBUG=false`). You must supply **real ≥16-char throwaway secrets** for staging (see §5), or the backend never becomes healthy → `depends_on` never releases → **frontend never starts.**

---

## 4. POSTGRES + MIGRATE

```yaml
  postgres:
    image: postgres:16-alpine
    container_name: wedding-postgres
    networks: [wedding]
    environment:
      POSTGRES_USER: wedding
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set me}
      POSTGRES_DB: wedding_dev            # reconcile name — see open item below
    volumes:
      - pgdata:/var/lib/postgresql/data   # named volume = persistence
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wedding -d wedding_dev"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: unless-stopped
```

- **DB persistence = named volume `pgdata`** on `/var/lib/postgresql/data`. Do **not** bind-mount a host dir for the data dir on Windows (perms/locking issues). A named volume survives `docker compose down` (only `down -v` wipes it).
- **`migrate` (one-shot, optional):** if migrations run as a separate service, build from `production/backend`, `depends_on: postgres: service_healthy`, run the migration command, `restart: "no"`. Then `backend.depends_on` should also wait on `migrate: service_completed_successfully`. Confirm whether the project runs Alembic / a migration script (check `production/backend` for `alembic*` / `migrations/` / a `migrate` entrypoint) — if migrations are applied at app startup instead, skip this service.

---

## 5. Environment variable injection (backend)

Backend needs these at **runtime** (compose `environment:`/`env_file:`), **never baked into the image**:

| Var | Value (staging) | Notes |
|---|---|---|
| `ENVIRONMENT` | `staging` | triggers strict validation |
| `DEBUG` | `false` | `true` is rejected for staging |
| `DATABASE_URL` | `postgresql://wedding:<pw>@postgres:5432/wedding_dev` | host = service name `postgres` |
| `JWT_SECRET` | real, ≥16 chars, no banned tokens | e.g. `test-jwt-secret-0123456789abcdef` |
| `API_KEY_SECRET` | real, ≥16 chars | |
| `SESSION_SECRET_KEY` | real, ≥16 chars | session-cookie auth |
| `API_URL` | staging URL | required for staging |
| `FRONTEND_URL` | staging URL | required for staging |
| `CORS_ORIGINS_RAW` | must include the staging frontend origin | the origin the browser uses |
| `LOG_LEVEL` | `INFO` | |
| `METRICS_ENABLED`, `SENTRY_DSN` | optional | valid HTTPS DSN if set |

- **`CORS_ORIGINS_RAW` nuance:** because the SPA calls **same-origin** `/api` (browser → nginx → backend), cross-origin CORS is mostly avoided in normal flow. Still set it to the staging frontend origin to be safe; the browser only ever sees the frontend origin.
- **Frontend:** no env vars. Nothing to inject.
- Banned secret tokens (cause startup failure): `replace-with`, `dev-`, `change-in-production`; secrets `<16` chars.

---

## 6. Network, ports, startup order

**Network:** one user-defined bridge network `wedding`. Every service joins it. Docker DNS resolves service names (`backend`, `postgres`, `frontend`).
```yaml
networks:
  wedding:
    driver: bridge
volumes:
  pgdata:
  backend_logs:
```

**Port mappings (host → container):**
- `frontend`: `80:8080` (or `3000:8080` if staging prefers 3000). Container port is **8080**.
- `backend`: **none** (internal).
- `postgres`: **none** (internal). Publish `5432` only for local DB debugging, not in shared staging.

**Startup order (via `depends_on` + healthchecks):**
```
postgres (healthy)
   └─> [migrate (completed_successfully)]   # if a migrate service exists
          └─> backend (healthy via /health)
                 └─> frontend (healthy via /healthz)
```
The chain is gated on **health/completion conditions**, not just "started", because the backend builds its DB engine at import and the frontend's nginx upstream needs the backend reachable.

---

## 7. What Agent 4 must verify

1. **`docker compose build`** succeeds for both `backend` and `frontend` (I could **not** run a live build — Docker Desktop engine was down in my environment; nginx.conf was validated structurally only). Run `nginx -t` implicitly via the frontend build/start.
2. **`docker compose up`** brings services healthy in order: postgres → backend → frontend.
3. **Frontend serves the SPA:** `curl -I http://localhost/` → 200, `text/html`; deep link `curl -I http://localhost/admin` → 200 (SPA fallback, not 404).
4. **`/api` proxy works:** `curl -i http://localhost/api/health` (or an existing `/api/...` route) reaches the backend through nginx and returns the backend's response — **prefix preserved**. A 404 on a known route means someone added a trailing slash to `proxy_pass`; revert it.
5. **`/healthz`** on the frontend returns `200 ok`; **`/health`** on the backend (internal) is healthy.
6. **Non-root containers:** `docker compose exec frontend id` → uid 101 (nginx); `docker compose exec backend id -u` → 10001.
7. **No secrets baked:** `docker history --no-trunc wedding-frontend:staging` and `wedding-backend:staging` show no secrets; `docker compose exec frontend env` shows no secrets (frontend has none).
8. **DB persistence:** data survives `docker compose down` + `up` (named volume `pgdata`); confirm a row written then re-read after restart.
9. **Cookie auth round-trip:** log in via the SPA through nginx; confirm the session cookie is set and `/api/auth/me` succeeds (validates header/cookie forwarding through the proxy).

---

## 8. Open items to reconcile (carry forward)

1. **DB name:** task says `wedding_dev`, the `.env` `DATABASE_URL` path may say `wedding`. Make `POSTGRES_DB`, `pg_isready -d`, and `DATABASE_URL` agree.
2. **Staging domain:** `.env.staging` placeholder domain vs the task's `stage-ashley-and.hazel-of-halifax.com` vs architecture open item #1. Set `API_URL`/`FRONTEND_URL`/`CORS_ORIGINS_RAW` consistently.
3. **Published frontend port:** `80:8080` vs `3000:8080`. Pick per staging convention; container side stays 8080.
4. **Migrate service:** confirm whether migrations run as a one-shot service or at app startup; wire `depends_on` accordingly.
5. **Image tags:** use `:staging` (moving) + `:staging-<gitsha>` (immutable) per Part C; no `latest`.

---

## 9. TL;DR for Agent 4
- Frontend: service `frontend`, build `./production/frontend`, container port **8080**, publish `80:8080`, `depends_on backend: service_healthy`, non-root, healthcheck `/healthz`. **Reverse proxy is self-contained — just keep `backend` on the `wedding` network.**
- Do **not** touch `nginx.conf`'s `proxy_pass` (no trailing slash — preserves `/api`).
- Backend is internal-only on `3001`; gate it on `postgres: service_healthy`; inject **real** ≥16-char secrets or nothing comes up healthy.
- One `wedding` bridge network; named volumes `pgdata` (DB) + `backend_logs`.

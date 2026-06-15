# AGENT 1 — DOCKERFILE SPECIFICATIONS
## Backend (Agent 2) & Frontend (Agent 3)

**Author:** Agent 1
**Date:** 2026-06-15
**Companion to:** `AGENT1_ARCHITECTURE_SPECIFICATION.md`
**Status:** SPECIFICATION — Agents 2 & 3 implement from this.

> These specs are grounded in the actual repo: `production/backend/requirements.txt`, `app/main.py` (`/health` exists, port 3001), `app/config.py` (strict secret validation), `app/db/database.py` (engine at import), and `production/frontend/{package.json, vite.config.ts}` (React + Vite, `dist/` output, `/api` proxy).

---

## PART A — BACKEND DOCKERFILE SPECIFICATION (for Agent 2)

### A.1 Objectives
- Multi-stage build, slim image, **non-root** runtime.
- **Fix the broken `HEALTHCHECK`** in the current `production/backend/Dockerfile` (it imports `requests`, which is NOT in `requirements.txt`).
- No secrets, no `.env*`, no caches in the image.
- Listen on `0.0.0.0:3001`, expose `/health` for the probe.

### A.2 Base image
- **`python:3.12-slim`** for both stages.
  - Rationale: `requirements.txt` pins `pydantic==2.5.0`, `sqlalchemy==2.0.23`, `fastapi==0.104.1`, `psycopg2-binary==2.9.9` — all have py3.12 wheels. `-slim` keeps it small while still glibc (avoids alpine/musl wheel-compilation pain for `psycopg2`/`pydantic-core`).
  - Hardening note (later): pin by digest `python:3.12-slim@sha256:...`.

### A.3 Build stages

**Stage 1 — `builder`:**
1. `FROM python:3.12-slim AS builder`
2. `WORKDIR /app`
3. Install build deps defensively: `apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*`.
   - `psycopg2-binary` ships wheels (no compile), but keep `gcc` for any sdist fallback. `postgresql-client` is **not** needed in builder.
4. `COPY requirements.txt .`
5. Install into an isolated prefix (NOT `/root/.local`, so it copies cleanly to a non-root runtime):
   `pip install --no-cache-dir --prefix=/install -r requirements.txt`
   - `--prefix=/install` puts libs in `/install/lib/...` and scripts in `/install/bin`, trivially copyable into the runtime's `/usr/local`.

**Stage 2 — `runtime`:**
1. `FROM python:3.12-slim AS runtime`
2. `ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1`
3. (Optional) runtime-only OS deps: `postgresql-client` **only if** the backend itself must run `psql` (it does not — migrations run in the dedicated `migrate` service). **Recommend omitting** to keep the image minimal. Include only if Agent 4 decides the backend runs migrations.
4. Create non-root user:
   `RUN useradd --create-home --uid 10001 appuser`
5. Copy installed packages from builder: `COPY --from=builder /install /usr/local`
   - This lands libs on the default `sys.path` and console scripts (`uvicorn`) on `PATH` — no `ENV PATH` juggling needed.
6. `WORKDIR /app`
7. Copy app source with correct ownership: `COPY --chown=appuser:appuser . .`
   - Relies on `.dockerignore` to exclude `.env*`, caches, `logs`, `.git`, venvs, `docs`, `tests` (tighten `.dockerignore` — see A.8).
8. Create + own the logs dir: `RUN mkdir -p logs && chown -R appuser:appuser logs`
   - `LOG_FILE_PATH=logs/app.log`; this dir is also the mount point for the `backend_logs` volume.
9. `USER appuser`
10. `EXPOSE 3001`
11. **Fixed health check** (see A.5).
12. **Entry point** (see A.4).

### A.4 Entry point
Two acceptable forms; **prefer the explicit uvicorn form**:

- Preferred: `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001"]`
  - Direct, no extra Python wrapper, honors the same `app` object. Host/port are fixed to match `EXPOSE` and the health check. (`.env` `APP_HOST/APP_PORT` already say `0.0.0.0`/`3001`, so no behavioral change.)
- Acceptable: `CMD ["python", "main.py"]`
  - Uses the existing compat entrypoint which reads `APP_HOST/APP_PORT` from settings. Works, but couples the listen port to env — keep it `3001` to match `EXPOSE`/health check.

> Do NOT add `--reload` (dev only). Do NOT add `--workers N` yet — the app initializes Sentry/metrics/logging at import; multi-worker is a later tuning step, validate single-worker first.

### A.5 Health check (THE KEY FIX)
The current Dockerfile's `import requests` will always fail. Replace with a dependency that exists.

**Preferred (stdlib, zero deps):**
```
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:3001/health').status==200 else 1)"
```
**Acceptable (uses `httpx`, which IS in requirements.txt):**
```
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import httpx,sys; sys.exit(0 if httpx.get('http://localhost:3001/health').status_code==200 else 1)"
```
- `start-period=20s` gives uvicorn + `validate_for_startup()` + Sentry/logging init time to come up before failures count.
- Hits `/health` (exists, line 79 of `app/main.py`), NOT `/api/guests` (that touches the DB; too heavy/coupled for liveness).

### A.6 Port exposure
- `EXPOSE 3001` (documentation/intent only). **No published port in compose** — backend is internal-only, reached via nginx `/api` proxy. (See architecture §2.1.)

### A.7 Environment variables
- **Image-level (safe, non-secret):** `PYTHONUNBUFFERED=1`, `PYTHONDONTWRITEBYTECODE=1`. Nothing else baked.
- **Runtime-injected (compose `env_file`/`environment`, NEVER in image):**
  - `ENVIRONMENT=staging`
  - `DATABASE_URL=postgresql://wedding:<pw>@postgres:5432/wedding_dev` (host = service name `postgres`)
  - `JWT_SECRET`, `API_KEY_SECRET`, `SESSION_SECRET_KEY` — **real, ≥16 chars, no `replace-with`/`dev-`/`change-in-production`** (config.py rejects placeholders for staging).
  - `API_URL`, `FRONTEND_URL` — required for staging; reconcile with real domain (see open item #1).
  - `CORS_ORIGINS_RAW` — must include the staging frontend origin.
  - `DEBUG=false`, `LOG_LEVEL=INFO`, `SENTRY_DSN` (optional, valid HTTPS DSN), `METRICS_ENABLED=true`, etc.
- **Do not** `COPY .env.staging`/`.env.production` into the image. They contain placeholders that fail validation and would leak structure. `.dockerignore` already lists them — keep it.

### A.8 `.dockerignore` (tighten current)
Current excludes: `.pytest_cache, __pycache__, *.pyc, .env, .env.staging, .env.production, .git, .gitignore, logs, *.log, .venv, venv`. **Add:**
```
.env.example
docs/
tests/
.pytest_cache/
*.md
scripts/
.dockerignore
Dockerfile
```
- Keeps the image to just `app/`, `main.py`, `requirements.txt`. Smaller, fewer surprises, no test/doc bloat.

### A.9 Security considerations
- **Non-root** `appuser` (uid 10001) — required.
- No secrets in layers (verify with `docker history`).
- Read-only root filesystem is a later hardening option; the app writes to `logs/` (mounted volume) so a `read_only: true` + `tmpfs` for logs is feasible later, not now.
- Drop build deps from runtime stage (already separated by multi-stage).
- `psycopg2-binary` is fine for staging; production may switch to `psycopg2` (source) for security/perf, out of scope here.

### A.10 Backend Dockerfile — structural summary (NOT final code; Agent 2 writes it)
```
# builder
FROM python:3.12-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# runtime
FROM python:3.12-slim AS runtime
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
RUN useradd --create-home --uid 10001 appuser
COPY --from=builder /install /usr/local
WORKDIR /app
COPY --chown=appuser:appuser . .
RUN mkdir -p logs && chown -R appuser:appuser logs
USER appuser
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:3001/health').status==200 else 1)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001"]
```

---

## PART B — FRONTEND DOCKERFILE SPECIFICATION (for Agent 3)

### B.1 Objectives
- Multi-stage: **build with Node, serve with nginx** (static `dist/`). No Node in the runtime image.
- nginx serves the SPA (with `try_files` fallback for client-side routing — the app uses `react-router-dom`) and reverse-proxies `/api/` → `backend:3001`, so the SPA calls **same-origin** `/api/...` (no baked absolute API URL).
- Small, non-root nginx, health endpoint.

### B.2 Stage 1 — build (`node:20-alpine`)
1. `FROM node:20-alpine AS build`
2. `WORKDIR /app`
3. `COPY package.json package-lock.json ./`
4. `RUN npm ci` — deterministic install from the committed lockfile.
5. `COPY . .`
6. (If the app reads an API base URL) accept `ARG VITE_API_BASE_URL` and pass through `ENV` before build. **With the nginx `/api` proxy, prefer NOT to need this** — keep the SPA on relative `/api`.
7. `RUN npm run build` → produces `/app/dist`.

> Node 20 LTS satisfies `vite ^5`, `@vitejs/plugin-react ^4`, `react ^18`. Use `node:20-alpine` for build only (musl is fine for building static assets; nothing ships to runtime).

### B.3 Stage 2 — serve (`nginx:1.27-alpine`)
1. `FROM nginx:1.27-alpine AS serve`
2. `COPY --from=build /app/dist /usr/share/nginx/html`
3. Provide nginx config (mounted `:ro` via compose at `/etc/nginx/conf.d/default.conf`, OR `COPY`'d in — compose-mounted is preferred so it can differ per environment without rebuild). Config must include:
   - `listen 8080;` (non-privileged port → enables non-root nginx).
   - `root /usr/share/nginx/html; index index.html;`
   - SPA fallback: `location / { try_files $uri $uri/ /index.html; }`
   - API proxy: `location /api/ { proxy_pass http://backend:3001/; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }`
   - Health: `location = /healthz { return 200 'ok'; add_header Content-Type text/plain; }`
4. `EXPOSE 8080`
5. **Non-root nginx:** use the `nginxinc/nginx-unprivileged:1.27-alpine` image OR adjust permissions and run as the `nginx` user; ensure pid/cache/log paths are writable. (Note for Agent 3: the stock `nginx:alpine` master runs as root by default — switching to the unprivileged variant is the clean path and listens on 8080 by default.)
6. `HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD wget -qO- http://localhost:8080/healthz || exit 1`

> The proxy target `backend:3001` resolves via Docker DNS on the `wedding` network. This replaces the dev-only `vite.config.ts` proxy (`127.0.0.1:3001`), which is invalid inside containers.

### B.4 Port exposure
- `EXPOSE 8080`. Compose publishes `80:8080` (and `443` if TLS terminates here). Backend stays unpublished.

### B.5 Environment variables (frontend)
- The SPA, served as static files, has **no runtime env**. Any configuration must be either:
  - **Same-origin relative `/api`** (RECOMMENDED — zero build args, works in staging and prod unchanged), or
  - **Build-time `VITE_*`** baked at `npm run build` via `ARG`/`ENV` (only if absolute API URLs are unavoidable; then you need a per-environment rebuild — discouraged).
- No secrets ever in the frontend image (anything in a built SPA is public).

### B.6 Frontend Dockerfile — structural summary (NOT final code; Agent 3 writes it)
```
# build
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# serve
FROM nginxinc/nginx-unprivileged:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
# default.conf provided via compose :ro mount (SPA fallback + /api proxy + /healthz)
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/healthz || exit 1
```

### B.7 `.dockerignore` for frontend (create one)
```
node_modules
dist
test-results
tests
*.txt
playwright.config.ts
.git
*.md
Dockerfile
.dockerignore
```
- Critically excludes `node_modules` (rebuilt by `npm ci`) and `dist` (rebuilt by `npm run build`) so stale/host-platform artifacts don't poison the build.

---

## PART C — SHARED CONVENTIONS

- **Image tags:** `wedding-backend:staging-<gitsha>` + moving `:staging`; same for frontend. Immutable SHA tags enable instant rollback (architecture §5.4).
- **No `latest`** in compose; pin to `:staging` (moving) or `:staging-<gitsha>` (immutable).
- **Build context** is each service's own directory (`production/backend`, `production/frontend`) to keep contexts small and `.dockerignore` effective.
- **Verify no secrets baked:** after build, `docker history --no-trunc <image>` and `docker run --rm <image> env` must show no real secrets and no `.env.*` content.
```

# AGENT 2 HANDOVER — BACKEND DOCKERFILE IMPLEMENTATION

**From:** Agent 1 (Planning & Architecture)
**To:** Agent 2 (Backend Containerization)
**Date:** 2026-06-15
**Read first:** `AGENT1_ARCHITECTURE_SPECIFICATION.md` (§1, §2.6, §2.7) and `AGENT1_DOCKERFILE_SPECS.md` (Part A).
**Working dir:** `C:\dev\ashley-hazel-wedding-portal-prototype\production\backend\`

---

## 1. Your Bounded Task

Replace the existing **broken** `production/backend/Dockerfile` with a correct multi-stage, non-root, slim image that:
1. Builds the FastAPI backend with its pinned dependencies.
2. Runs as a **non-root** user.
3. Has a **working** health check (the current one imports `requests`, which is NOT installed — it fails 100% of the time).
4. Bakes **no** secrets and **no** `.env.*` files.
5. Listens on `0.0.0.0:3001` and serves `GET /health` → 200.

You own the backend Dockerfile and `.dockerignore` only. You do NOT write docker-compose (Agent 4) or the frontend (Agent 3).

---

## 2. Critical Context You MUST Know

### 2.1 The current Dockerfile is broken in 3 ways
- **Health check:** `CMD python -c "import requests; ..."` — `requests` is not in `requirements.txt` (it has `httpx`). Every probe raises `ModuleNotFoundError` → container is permanently `unhealthy` → `depends_on: service_healthy` never releases → **frontend never starts.** This is the #1 bug to fix.
- **Runs as root:** installs to `/root/.local`, no `USER` directive. Must run as non-root.
- **`pip install --user`** puts packages in `/root/.local`, which doesn't transfer cleanly to a non-root user. Switch to `--prefix=/install` → `COPY --from=builder /install /usr/local`.

### 2.2 The app refuses to boot with placeholder secrets
`app/config.py` `environment_errors()` rejects, for `ENVIRONMENT=staging`:
- secrets `< 16` chars,
- secrets containing `replace-with`, `dev-`, or `change-in-production`,
- `DEBUG=true`, missing `API_URL`/`FRONTEND_URL`.

The committed `.env.staging` has placeholder secrets ON PURPOSE. **If you try to test the image by copying `.env.staging` into it, the app will crash on startup.** For your local smoke test, inject REAL throwaway test secrets via `docker run -e ...` (see §5). Never `COPY` any `.env.*` into the image.

### 2.3 The DB engine is created at import time
`app/db/database.py` builds the SQLAlchemy engine at import. The app won't fully serve without a reachable Postgres at `DATABASE_URL`. **However, `GET /health` does NOT touch the DB** (see `app/main.py` line 79–81) — so you CAN validate the container's health check with a dummy `DATABASE_URL` as long as `validate_for_startup()` passes. The engine is created lazily-connecting, so import succeeds even if the DB host is unresolvable; only DB-backed endpoints would fail. This makes `/health` a clean liveness probe.

### 2.4 `/health` exists and is DB-free
`GET /health` → `{"status":"healthy","message":"..."}` with HTTP 200. Probe THIS, not `/api/guests`.

---

## 3. The Exact Dockerfile (line-by-line)

Write this to `production/backend/Dockerfile`:

```dockerfile
# ---------- Stage 1: builder ----------
FROM python:3.12-slim AS builder

WORKDIR /app

# gcc kept defensively for any sdist fallback (psycopg2-binary/pydantic-core ship wheels).
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

# Install deps into an isolated prefix so they copy cleanly into a non-root runtime.
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---------- Stage 2: runtime ----------
FROM python:3.12-slim AS runtime

# Unbuffered stdout/stderr (logs flush immediately); no .pyc clutter.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Non-root runtime user.
RUN useradd --create-home --uid 10001 appuser

# Bring installed packages + console scripts (uvicorn) onto the default path.
COPY --from=builder /install /usr/local

WORKDIR /app

# App source only (see .dockerignore). Owned by the non-root user.
COPY --chown=appuser:appuser . .

# Log dir is the mount point for the backend_logs volume; must be writable by appuser.
RUN mkdir -p logs && chown -R appuser:appuser logs

USER appuser

EXPOSE 3001

# Working health check using stdlib only (no extra deps). Hits the DB-free /health.
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:3001/health').status==200 else 1)"

# Explicit uvicorn entrypoint; host/port fixed to match EXPOSE and the health check.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001"]
```

### Line-by-line rationale
| Line(s) | Why |
|---|---|
| `FROM python:3.12-slim AS builder` | All pinned deps have 3.12 wheels; slim+glibc avoids musl wheel pain for `psycopg2`/`pydantic-core`. |
| `apt-get ... gcc ... rm -rf lists` | Build-time compiler available if a wheel is unavailable; clean apt cache to keep layer small. |
| `pip install --prefix=/install` | Isolated, relocatable install — copies into `/usr/local` of a non-root runtime without `/root/.local` ownership issues. |
| `FROM python:3.12-slim AS runtime` | Fresh minimal runtime; no `gcc`/build cruft. |
| `ENV PYTHONUNBUFFERED/DONTWRITEBYTECODE` | Immediate logs (important for Docker log capture); no `.pyc`. |
| `useradd ... appuser` | Non-root requirement. uid 10001 is arbitrary but fixed/high to avoid host UID clashes. |
| `COPY --from=builder /install /usr/local` | Puts libs on `sys.path` and `uvicorn` on `PATH` with zero `ENV PATH` fiddling. |
| `COPY --chown=appuser:appuser . .` | App code owned by runtime user; `.dockerignore` keeps it to `app/`, `main.py`, `requirements.txt`. |
| `mkdir -p logs && chown` | `LOG_FILE_PATH=logs/app.log`; the volume mounts here and must be writable by `appuser`. |
| `USER appuser` | Drop privileges before running the app. |
| `EXPOSE 3001` | Documents the listen port (not published in compose — backend is internal-only). |
| `HEALTHCHECK ... urllib ... /health` | **THE FIX.** stdlib only, DB-free endpoint, `start-period=20s` to cover boot. |
| `CMD uvicorn app.main:app ...` | Direct ASGI run on `0.0.0.0:3001`, matching EXPOSE + health check. No `--reload`, single worker for now. |

---

## 4. Also update `.dockerignore`

Append to `production/backend/.dockerignore` (keep existing entries):
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
This trims `docs/`, `tests/`, `scripts/`, the example env, and markdown from the build context — image carries only the running app.

> Keep the existing `.env`, `.env.staging`, `.env.production` exclusions. Those MUST never enter the image.

---

## 5. Testing Procedures

Run these from `production/backend/`. (Docker Desktop on Windows; Bash tool for POSIX-style commands.)

### 5.1 Build
```bash
docker build -t wedding-backend:test .
```
Expect: clean multi-stage build, two `FROM` stages, no errors.

### 5.2 Confirm non-root
```bash
docker run --rm wedding-backend:test whoami        # -> appuser
docker run --rm wedding-backend:test id -u          # -> 10001
```

### 5.3 Confirm no secrets / no env files baked
```bash
docker run --rm wedding-backend:test sh -c 'ls -la /app && ! test -f /app/.env.staging && echo NO_ENV_OK'
docker run --rm wedding-backend:test env | grep -iE 'secret|jwt|password' || echo "NO_BAKED_SECRETS_OK"
docker history --no-trunc wedding-backend:test | grep -iE 'secret|password' || echo "HISTORY_CLEAN_OK"
```

### 5.4 Confirm the app boots and `/health` works (with REAL throwaway secrets)
The app validates staging config, so pass real (test) values, not placeholders:
```bash
docker run --rm -p 3001:3001 \
  -e ENVIRONMENT=staging \
  -e DEBUG=false \
  -e DATABASE_URL="postgresql://wedding:weddingpw@host.docker.internal:5432/wedding_dev" \
  -e API_URL="https://stage-ashley-and.hazel-of-halifax.com" \
  -e FRONTEND_URL="https://stage-ashley-and.hazel-of-halifax.com" \
  -e CORS_ORIGINS_RAW="https://stage-ashley-and.hazel-of-halifax.com" \
  -e JWT_SECRET="test-jwt-secret-0123456789abcdef" \
  -e API_KEY_SECRET="test-api-key-secret-0123456789ab" \
  -e SESSION_SECRET_KEY="test-session-secret-0123456789abc" \
  --name wb-test wedding-backend:test
```
In another shell:
```bash
curl -fsS http://localhost:3001/health        # -> {"status":"healthy",...}
docker inspect --format='{{.State.Health.Status}}' wb-test   # -> healthy (after start-period)
```
> The secrets above are exactly 16+ chars and contain none of the banned tokens, so `validate_for_startup()` passes. If you see `Invalid environment configuration: ...JWT_SECRET must be...`, your test secret is too short or contains a banned word.

> A real Postgres at the `DATABASE_URL` is only needed to exercise `/api/*`. `/health` and the health check pass without it because import is lazy-connecting.

### 5.5 Image size sanity
```bash
docker images wedding-backend:test     # expect a few hundred MB, not >1GB
```

---

## 6. Success Criteria (all must pass)

- [ ] `docker build` succeeds, two-stage.
- [ ] `whoami` → `appuser`, `id -u` → `10001` (non-root).
- [ ] No `.env.*` files inside `/app`; no real secrets in `env` or `docker history`.
- [ ] Container starts and `curl /health` returns 200 with real test secrets.
- [ ] `docker inspect` health status reaches `healthy` (proves the health-check FIX works — this is the gate for the whole stack).
- [ ] `EXPOSE 3001`; entrypoint runs uvicorn on `0.0.0.0:3001`.
- [ ] `.dockerignore` keeps `docs/`, `tests/`, `scripts/`, all `.env.*` out of the image.
- [ ] Image is `-slim`-based and reasonably small.

---

## 7. Troubleshooting Guide

| Symptom | Likely cause | Fix |
|---|---|---|
| Container `unhealthy` forever | Health check still importing `requests`, or app not on 3001 | Confirm `HEALTHCHECK` uses `urllib`/`httpx` and hits `/health`; confirm `CMD` port = 3001. |
| `Invalid environment configuration: ... must be replaced` | Placeholder or short secret | Use real 16+ char secrets without `replace-with`/`dev-`/`change-in-production`. |
| `Invalid environment configuration: API_URL is required` | Missing `API_URL`/`FRONTEND_URL` for staging | Pass both as env vars. |
| `ModuleNotFoundError: app` | Wrong WORKDIR / source not copied | Ensure `WORKDIR /app` and `COPY . .` put `app/` under `/app/app/`. |
| `uvicorn: not found` | `/install` not copied or wrong prefix | `COPY --from=builder /install /usr/local`; verify `pip --prefix=/install`. |
| `Permission denied` writing `logs/app.log` | logs dir not owned by appuser | `RUN mkdir -p logs && chown -R appuser:appuser logs` before `USER appuser`. |
| `psycopg2` build error | wheel unavailable for platform | `gcc` is installed in builder; if still failing, add `libpq-dev` to builder apt line. |
| Health check passes but `/api/guests` 500s | No DB reachable | Expected without Postgres; not a Dockerfile bug. Validate full path under compose (Agent 4). |

---

## 8. Questions to Ask If Unclear (raise to Agent 1 / human)

1. **Entry point:** OK to standardize on `uvicorn app.main:app` over `python main.py`? (Spec prefers uvicorn; both work. Confirm no one depends on `main.py` side effects.)
2. **`postgresql-client` in runtime:** keep it OUT of the backend image (migrations run in the dedicated `migrate` service)? Confirm with Agent 4 that the backend never runs `psql`.
3. **DB name:** is the staging database `wedding_dev` (task) or `wedding` (the `.env` `DATABASE_URL` path)? Align `DATABASE_URL` accordingly.
4. **Domain:** `.env.staging` uses `staging.ashley-hazel-wedding.example`, the task uses `stage-ashley-and.hazel-of-halifax.com`. Which is canonical for staging env vars? (Open item #1 in the architecture spec.)
5. **Workers:** single uvicorn worker for staging acceptable? (App does import-time Sentry/metrics init; multi-worker is a later tuning task.)

---

## 9. Handoff Out (what you produce for Agent 4)

When done, hand Agent 4:
- Final image name/tag convention used (recommend `wedding-backend:staging-<gitsha>`).
- Confirmed listen port (3001), health endpoint (`/health`), health-check command.
- The exact list of runtime env vars the container requires (from §2.2 / Dockerfile spec A.7) so Agent 4 wires `env_file`/`environment` correctly.
- Confirmation that the backend needs `depends_on: postgres: service_healthy` (it does — import-time engine) and `restart: unless-stopped`.
```

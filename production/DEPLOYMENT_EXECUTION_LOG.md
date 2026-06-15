# DEPLOYMENT EXECUTION LOG — Agent 7 (Staging Deploy & Validation)

**Target:** `deploy@192.168.0.32` (host `wedding-db`, Ubuntu 24.04.3 LTS)
**Repo on VM:** `/home/deploy/wedding-dashboard/`
**Deployment window:** 2026-06-15 ~17:33–17:56 UTC
**Result:** SUCCESS — 3/3 containers healthy, all endpoint validations passed.

> NOTE ON ENVIRONMENT TRUTH: The premise handed to Agent 7 ("Docker installed, artifacts
> already on the VM, just run deploy.sh") did **not** match reality. Two hard blockers were
> found and fixed before any deploy could occur (see Pre-Deployment Findings). This log records
> what was actually true, not the assumed state.

---

## 1. Pre-Deployment Checklist (ACTUAL)

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| SSH connectivity to .32 | reachable | `CONNECTED / wedding-db / deploy` | PASS |
| Passwordless sudo | available | `PASSWORDLESS_SUDO_OK` | PASS |
| OS | Linux | Ubuntu 24.04.3 LTS (noble) | PASS |
| Docker installed | yes | **`docker: command not found`** | **FAIL → fixed** |
| docker compose available | yes | **not present** | **FAIL → fixed** |
| Docker artifacts on VM (compose, Dockerfiles, new deploy.sh) | present | **ABSENT** — VM had only the OLD bare-metal `deploy.sh` (7913 B). Compose/Dockerfiles existed only in the local working tree (Agents 2–6 outputs were never pushed/pulled to the VM). | **FAIL → fixed** |
| Backend source + requirements.txt | present | present | PASS |
| Frontend source + package-lock.json | present | present | PASS |
| `database/schema.sql` | present | present (10.7 KB) | PASS |
| Disk / RAM headroom | adequate | 24 GB free / 3.9 GB RAM | PASS |

### Pre-Deployment Findings (Blockers Fixed)

1. **Docker Engine absent.** Installed Docker CE 29.5.3 + compose plugin v5.1.4 from
   Docker's official apt repo (`download.docker.com/linux/ubuntu noble stable`). Added `deploy`
   to the `docker` group. Daemon `active`.
2. **Docker artifacts absent on VM.** Copied from the local working tree via `scp` (non-destructive):
   `docker-compose.yml`, `docker-compose.prod.yml`, `.env.docker`,
   `backend/Dockerfile` + `.dockerignore`, `frontend/Dockerfile` + `nginx.conf` + `.dockerignore`,
   `scripts/deploy.sh` (the 18.5 KB Docker version) + `scripts/rollback.sh`.
   The OLD bare-metal `deploy.sh` on the VM was backed up to `scripts/deploy.sh.baremetal.bak`.
3. **Host-port collisions.** The live bare-metal dev stack was still running and listening on
   `3001` (FastAPI) and `5432` (system PostgreSQL); `docker-compose.yml` published those same host
   ports. To validate WITHOUT tearing down the live dev stack, the base compose host ports were
   parameterized (`${POSTGRES_HOST_PORT:-5432}`, `${BACKEND_HOST_PORT:-3001}`,
   `${FRONTEND_HOST_PORT:-80}`) and the validation run used `5433 / 3010 / 8088`.
   Container-internal ports (postgresql:5432, backend:3001, frontend:8080) are unchanged.
   `docker-compose.yml.orig.bak` holds the pre-edit version.

---

## 2. Deployment Steps Executed

```
# Docker install (official repo)
add docker apt keyring + repo (noble) ; apt-get install docker-ce docker-ce-cli \
  containerd.io docker-buildx-plugin docker-compose-plugin ; usermod -aG docker deploy
# -> Docker 29.5.3, Compose v5.1.4, daemon active

# Artifacts copied via scp (see Findings #2)

# Secrets (test) written to production/.env.test (staging-grade, >=32 char secrets)

# Build
cd production ; set -a; . ./.env.test; set +a
docker compose -f docker-compose.yml build         # exit 0; both images built

# Bring up (parameterized host ports 5433/3010/8088)
docker compose -f docker-compose.yml up -d          # exit 0 after config fix below
```

### First up attempt FAILED — root-caused and fixed
- **Symptom:** `wedding-backend is unhealthy`; frontend never started (depends on healthy backend).
- **Backend log:** `ValueError: Invalid environment configuration: API_URL is required outside
  development; FRONTEND_URL is required outside development` (from `config.validate_for_startup()`).
- **Cause:** `ENVIRONMENT=staging` makes `app/config.py` require non-empty `API_URL` and
  `FRONTEND_URL` (and `DEBUG=false`); these were empty in the test env.
- **Fix:** Added to `.env.test`:
  `API_URL=http://192.168.0.32:8088/api`, `FRONTEND_URL=http://192.168.0.32:8088`,
  `CORS_ORIGINS_RAW=http://192.168.0.32:8088,http://localhost:8088`, `DEBUG=false`.
- **Re-up:** all three containers reached `healthy`.

---

## 3. Health Check Results

| Service | Mechanism | Result |
|---------|-----------|--------|
| postgresql | `pg_isready -U wedding -d wedding_dev` | `accepting connections` — HEALTHY |
| backend | stdlib urllib GET /health (Dockerfile + compose) | HEALTHY (200) |
| frontend | busybox wget `--spider /healthz` | HEALTHY (200) |

Startup ordering gated by health: postgresql (healthy) → backend (healthy) → frontend. Verified
in the compose up output and `docker inspect` health states.

---

## 4. Container Status (`docker ps`) — stable run

```
NAME                 IMAGE                     STATUS                   PORTS
wedding-backend      wedding-backend:latest    Up 8 minutes (healthy)   0.0.0.0:3010->3001/tcp
wedding-frontend     wedding-frontend:latest   Up 8 minutes (healthy)   0.0.0.0:8088->8080/tcp
wedding-postgresql   postgres:16-alpine        Up 9 minutes (healthy)   0.0.0.0:5433->5432/tcp
```

Restart policy: all three `unless-stopped` (verified via `docker inspect`).
Volumes created & persisting: `wedding-pgdata`, `wedding-backend-logs`.
Network: `wedding` (bridge).
Image sizes: frontend **74 MB**, backend **289 MB**, postgres:16-alpine 396 MB.
nginx config: `nginx -t` → syntax ok, test successful.

---

## 5. Port Connectivity Verification (validation host ports)

| URL | HTTP | Note |
|-----|------|------|
| `http://localhost:3010/health` (backend) | 200 | `{"status":"healthy",...}` |
| `http://localhost:8088/healthz` (frontend) | 200 | `ok` |
| `http://localhost:8088/` (SPA) | 200 | index.html, 328 B |
| `http://localhost:8088/api/guests` (nginx→backend) | 401 | `{"detail":"Not authenticated"}` — proxy reaches backend; endpoint is auth-walled (correct) |
| `http://localhost:8088/api/auth/login` (DB roundtrip) | 401 | `{"detail":"Invalid invite code"}` — backend queried `invites` table; full nginx→backend→PostgreSQL path proven |

---

## 6. Log Excerpts

- **backend / frontend logs:** clean — no errors/exceptions/tracebacks. Proxied requests in the
  backend log originate from `172.18.0.4` (the nginx container) confirming the reverse-proxy path.
- **postgresql:** one historical `FATAL: database "wedding_dev" does not exist` at 17:46:30 UTC —
  a transient artifact of the FIRST (failed) backend boot racing initdb. DB became ready at
  17:46:31 UTC and has been clean since; the database and all 14 tables now exist and are queryable.

---

## 7. Timestamp

Deployment validated and stable as of **2026-06-15 ~17:56 UTC**.

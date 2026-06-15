# Agent 4 → Agent 5 Handover: deploy.sh Docker-Compose Orchestration

Agent 4 delivered a validated three-service compose stack. Agent 5 owns the
deploy script that drives it. This document specifies exactly what deploy.sh
needs.

## Confirmed by Agent 4

- `docker-compose.yml` orchestrates all three services correctly. Validated with
  `docker compose config` (Compose v5.1.4) — base **and** merged-with-prod both
  resolve cleanly.
- Health checks gate startup: `postgresql healthy → backend healthy → frontend`.
- No secrets in images; required secrets fail-fast if unset.
- Schema applied at DB first-boot via `database/schema.sql` →
  `/docker-entrypoint-initdb.d/`.

## Critical ordering guarantee

**The frontend will not start until the backend reports healthy, and the
backend will not start until PostgreSQL reports healthy.** deploy.sh does not
need to sequence the services itself — compose enforces it. deploy.sh's job is
to (a) bring the stack up and (b) **poll until the whole stack is healthy** (or
roll back).

## Port-mapping strategy (staging vs production)

- **Staging:** run `docker-compose.yml` alone. Host ports published: 5432, 3001,
  `${FRONTEND_HOST_PORT:-80}`:8080.
- **Production:** layer the override —
  `-f docker-compose.yml -f docker-compose.prod.yml`. **No** host ports
  published (db/backend network-internal; frontend fronted by Traefik). The
  override uses `!reset []` to force-clear the base ports — do not "simplify" it
  back to `ports: []`, which silently leaks the host ports.

Select per environment in deploy.sh:
```bash
COMPOSE_FILES=(-f docker-compose.yml)
[ "$DEPLOY_ENVIRONMENT" = "production" ] && COMPOSE_FILES+=(-f docker-compose.prod.yml)
```

## deploy.sh steps (docker-compose path)

Run all from `production/` (where the compose files and `.env` live).

```bash
cd "$APP_DIR/production"

# Step 0 — secrets present (compose also fail-fast guards these)
: "${POSTGRES_PASSWORD:?}" "${JWT_SECRET:?}" "${API_KEY_SECRET:?}" "${SESSION_SECRET_KEY:?}"

# Step 1 — build images, tagged for rollback
export IMAGE_TAG="$(git rev-parse --short HEAD)"     # e.g. a1b2c3d
docker compose "${COMPOSE_FILES[@]}" build
#   also tag the previous IMAGE_TAG before overwriting (see rollback)

# Step 2 — stop old containers (KEEP volumes; never -v in deploy)
docker compose "${COMPOSE_FILES[@]}" down

# Step 3 — start new stack detached
docker compose "${COMPOSE_FILES[@]}" up -d

# Step 4 — verify processes exist
docker compose "${COMPOSE_FILES[@]}" ps

# Step 5 — health poll (see below)

# Step 6 — on failure, roll back (see below)
```

## Step 5 — health-poll strategy

Compose already gates ordering; deploy.sh polls for the *terminal* healthy
state of all services, then fails the deploy if any never reaches it. Prefer
querying container health state over hitting host ports (prod has none):

```bash
wait_healthy() {
  local deadline=$((SECONDS + 180)) all_ok
  while [ "$SECONDS" -lt "$deadline" ]; do
    all_ok=1
    for svc in postgresql backend frontend; do
      cid="$(docker compose "${COMPOSE_FILES[@]}" ps -q "$svc")"
      [ -n "$cid" ] || { all_ok=0; break; }
      state="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null)"
      [ "$state" = "healthy" ] || { all_ok=0; break; }
    done
    [ "$all_ok" = 1 ] && { echo "stack healthy"; return 0; }
    sleep 5
  done
  echo "stack did not become healthy in time" >&2
  return 1
}
```

Budget: postgres ~10–20s, backend `start_period` 20s, frontend 5s → a 180s
ceiling is comfortable. Staging may additionally curl `http://localhost:3001/health`
and `http://localhost:${FRONTEND_HOST_PORT:-80}/healthz` for an end-to-end check
(those host ports exist only in staging).

## Step 6 — rollback procedure (image tagging)

deploy.sh deploys by **immutable tag** (`IMAGE_TAG=<git-sha>`), not `latest`, so
rollback = re-up the previous tag. No rebuild needed.

```bash
# Before Step 1, record the currently-running tag as "previous":
echo "$IMAGE_TAG" > "$DEPLOY_STATE_DIR/previous_image_tag"   # after a good deploy

# Rollback:
export IMAGE_TAG="$(cat "$DEPLOY_STATE_DIR/previous_image_tag")"
docker compose "${COMPOSE_FILES[@]}" up -d        # re-runs prior images
wait_healthy || echo "rollback also unhealthy — page a human"
```

Notes:
- Both `backend` and `frontend` images read `${IMAGE_TAG:-latest}`, so a single
  `IMAGE_TAG` rolls both together.
- Keep the last N tagged images (don't prune aggressively) so rollback targets
  still exist locally.
- Trigger rollback automatically when `wait_healthy` fails after `up`.

## Secrets injection

- **Local/VM:** `cp .env.docker .env`, fill real values; compose auto-loads
  `.env`. `.env` must be git-ignored.
- **GitHub Actions:** export each as a step env from repo/environment Secrets
  (`POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY_SECRET`, `SESSION_SECRET_KEY`, and
  optionally `SENTRY_DSN`), then run compose. Compose reads the process
  environment — no `.env` file needed in CI. Required vars are `${VAR:?}`-guarded
  so a missing secret aborts the deploy loudly instead of booting insecurely.

## Database schema / migrations

- **First boot:** `schema.sql` auto-applies via the initdb mount — no deploy.sh
  action needed for a fresh `pgdata`.
- **Incremental migrations** (`database/migrations/00X_*.sql`) are NOT
  auto-applied. After Step 5 (DB healthy), deploy.sh should apply pending
  migrations against the running container, e.g.:
  ```bash
  for f in database/migrations/0*.sql; do
    docker compose "${COMPOSE_FILES[@]}" exec -T postgresql \
      psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f - < "$f"
  done
  ```
  (or track applied migrations in a table to avoid re-running). Run migrations
  **before** flipping traffic if you add a tracking mechanism.

## Logging / debugging

- `docker compose logs -f backend` (or `frontend` / `postgresql`) for live logs.
- `docker compose logs --since=10m backend` for recent slices.
- Backend file logs persist on the `wedding-backend-logs` volume
  (`/app/logs/app.log`, rotating).
- For aggregation later, attach a logging driver (json-file with rotation, or
  ship to syslog/Loki) per service — not required for first deploy.

## Open items for Agent 5

1. Add the docker-compose branch to `deploy.sh` (the current script is
   bare-metal uvicorn/PID-based). Gate it behind a `DEPLOY_MODE=docker` flag or
   replace the bare-metal path.
2. Update `BACKEND_HEALTH_URL` usage: the container probe already covers
   `/health`; the bare-metal script currently checks `/api/guests`.
3. Decide migration-tracking (simple table vs. a tool) so reruns are safe.

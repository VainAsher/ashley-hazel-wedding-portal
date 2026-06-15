# Agent 5 Implementation Log — Docker-native `deploy.sh`

Agent 5 rewrote `production/scripts/deploy.sh` from a bare-metal orchestrator
(uvicorn PIDs, `npm run dev`, venv installs, `psql` migrations) into a
docker-compose orchestrator driven by Agent 4's validated three-service stack.
A thin `production/scripts/rollback.sh` wrapper was added.

## Files produced / changed

- `production/scripts/deploy.sh` — completely rewritten (Docker-native).
- `production/scripts/rollback.sh` — new; `exec`s `deploy.sh rollback`.
- `production/AGENT5_IMPLEMENTATION_LOG.md` — this file.
- `production/AGENT6_HANDOVER.md` — GitHub Actions integration spec.

All bare-metal logic removed: no venv, no PID files, no `pgrep`/`kill`, no
`npm ci`/`npm run dev`, no host `psql`.

## How deploy.sh orchestrates Docker

`deploy.sh <command>` supports `deploy` (default), `rollback`, `status`,
`logs`, `help`. The deploy flow:

1. **Setup & validation** — resolve the compose binary (`docker compose` v2
   plugin preferred, legacy `docker-compose` fallback), pick compose files per
   environment, confirm docker + the daemon are reachable, load `.env` (if
   present), and validate the four required secrets.
2. **Git** — `git fetch origin $DEPLOY_BRANCH` + `git checkout --force
   $DEPLOY_REVISION` (skippable with `DEPLOY_SKIP_GIT=1` when CI already
   checked out the code).
3. **Image tag** — `IMAGE_TAG` is the git short SHA (immutable, per-release);
   exported so compose builds/tags `wedding-backend:<sha>` and
   `wedding-frontend:<sha>`. Falls back to a timestamp if git is unavailable.
4. **Build** — `compose build` (skippable with `DEPLOY_SKIP_BUILD=1`, e.g. when
   re-upping an already-built tag).
5. **Down → Up** — `compose down` (volumes preserved — never `-v`) then
   `compose up -d`.
6. **Health poll** — `wait_healthy` (see below).
7. **Migrations** — apply pending numbered SQL files inside the DB container.
8. **Endpoint verification** — staging only (see below).
9. **Record tags** — write current/previous image tags for rollback.

### Environment → compose file selection

```bash
COMPOSE_FILES=(-f docker-compose.yml)
[ "$DEPLOY_ENVIRONMENT" = "production" ] && COMPOSE_FILES+=(-f docker-compose.prod.yml)
```

Staging runs the base file (host ports 5432/3001/${FRONTEND_HOST_PORT} published).
Production layers the override (`!reset []` clears all host ports; Traefik
fronts the frontend). This matches Agent 4's port-mapping contract exactly.

## Health-check polling strategy and timeouts

Compose already gates *ordering* (`condition: service_healthy`:
postgresql → backend → frontend). deploy.sh does not re-sequence services; it
polls for the *terminal* healthy state of all three, then fails the deploy if
any never reaches it.

`wait_healthy`:
- Loops until `HEALTH_TIMEOUT` (default **180s**), polling every
  `HEALTH_INTERVAL` (default **5s**).
- For each service, resolves the container id via `compose ps -q`, then
  `docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}'`.
  A container with a healthcheck must report `healthy`; one without is accepted
  if merely `running`.
- **Fast-fail:** if any container is `exited`/`dead`, it returns immediately
  rather than waiting out the full timeout.
- Returns 0 only when all three are simultaneously healthy.

Timeout budget rationale (from Agent 4): postgres ~10–20s, backend
`start_period` 20s + retries, frontend 5s. 180s is a comfortable ceiling with
margin for image cold-starts.

### Endpoint verification (staging only)

After health, staging additionally curls `http://localhost:3001/health`
(backend) and `http://localhost:${FRONTEND_HOST_PORT}/healthz` (frontend) for an
end-to-end check. Production publishes **no** host ports, so these are skipped
there — container health is authoritative. This corrects the old script, which
hit `/api/guests`; the container probe owns `/health`.

## Error handling and rollback mechanics

- `set -Eeuo pipefail` + an `ERR` trap (`on_error`) catch unexpected failures
  with a line number.
- Build/up failures and unhealthy stacks call `capture_failure_logs`, which
  writes `compose ps` + `compose logs --tail=500` to `/tmp/deploy-failure.log`.
- **Auto-rollback:** if `wait_healthy` fails after `up` *and* a previous image
  tag is recorded, deploy.sh calls `rollback_to_tag <previous>` automatically,
  then exits non-zero so CI marks the run failed. If there is no previous tag
  (first deploy), it captures logs and dies without rollback.
- `rollback_to_tag` re-ups the previous immutable tag (no rebuild), polls
  health again, and if the rollback is *also* unhealthy, captures logs and dies
  with a "page a human" message — it never leaves the stack in a silently-broken
  state.

## Secret injection (GitHub Actions → env vars → docker-compose)

- Required secrets: `POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY_SECRET`,
  `SESSION_SECRET_KEY`. (`SENTRY_DSN` optional.)
- `load_env_file` sources `production/.env` if present (local/VM). In CI no
  `.env` exists; the secrets are already exported into the process environment
  and compose reads them directly.
- `validate_secrets` fails the deploy loudly (exit 1, names the missing vars)
  before any container starts — no booting insecurely.
- Secrets travel via the **environment**, never argv and never the filesystem
  in CI. The compose files restate `${VAR:?}` guards as a second line of defence.

## Migration strategy

- **First boot:** `database/schema.sql` auto-applies via the initdb mount
  (`/docker-entrypoint-initdb.d/01-schema.sql`) on an empty `pgdata`. No
  deploy.sh action.
- **Incremental migrations:** `database/migrations/[0-9]*.sql` (002–008 today)
  are applied by `apply_migrations` *after* the DB is healthy, by piping each
  file into `compose exec -T postgresql psql ... -f -`.
- **Idempotency:** a `schema_migrations(filename, applied_at)` table tracks
  applied files. Each deploy only runs files not already recorded, so reruns
  and redeploys are safe. (Agent 4 flagged this as an open decision; resolved
  here with the lightweight tracking table — no external migration tool needed.)

## Logging and debugging

- Every `log` line is timestamped (`%Y-%m-%dT%H:%M:%S%z`) and tee'd to
  `production/logs/deploy.log` (and stderr).
- Failure context lands in `/tmp/deploy-failure.log`.
- Live debugging: `deploy.sh logs` (or `compose logs -f <svc>`). Backend file
  logs persist on the `wedding-backend-logs` volume (`/app/logs/app.log`).

## Rollback procedure

- One-shot, no rebuild: `production/scripts/rollback.sh` (→ `deploy.sh
  rollback`) reads `production/.deploy/previous_image_tag`, exports it as
  `IMAGE_TAG`, `compose up -d`, and re-polls health.
- The previous images must still exist locally — do **not** aggressively prune
  old tags. Keep the last N releases.
- After a successful rollback the rolled-back tag becomes `current`; the bad tag
  is **not** promoted to a rollback target.

## State files

`production/.deploy/` (git-ignored):
- `current_image_tag` — tag currently serving.
- `previous_image_tag` — last-known-good tag (rollback target).

## Testing deploy.sh locally (no Docker required)

- `bash -n production/scripts/deploy.sh` — syntax check (passes).
- `bash -n production/scripts/rollback.sh` — passes.
- **Dry run** (prints commands, runs no docker/git, skips health/migrations):
  ```bash
  DRY_RUN=1 DEPLOY_SKIP_GIT=1 DEPLOY_ENVIRONMENT=staging \
    POSTGRES_PASSWORD=x JWT_SECRET=x API_KEY_SECRET=x SESSION_SECRET_KEY=x \
    bash production/scripts/deploy.sh deploy
  ```
  Verified: staging selects one compose file, production adds the override and
  skips curl, a missing secret aborts with exit 1, `help` needs no setup.

## Validation summary

| Check | Result |
|-------|--------|
| `bash -n` (both scripts) | PASS |
| Dry-run full deploy flow (staging) | PASS — build→down→up→health→migrate→verify→record |
| Dry-run production override selection | PASS — adds `-f docker-compose.prod.yml`, skips curl |
| Missing-secret abort | PASS — exit 1, names missing vars |
| All bare-metal logic removed | PASS — no venv/PID/npm/host-psql |
| Auto-rollback wired on health failure | PASS (logic; needs Docker for live test) |

## Notes for downstream

- Live container behaviour (build/up/health) was validated only by dry-run +
  syntax here (no Docker daemon used). The compose stack itself was validated by
  Agent 4 via `docker compose config`.
- Open item from Agent 4 (migration tracking) is resolved; the other two
  (docker branch, health URL) are implemented.

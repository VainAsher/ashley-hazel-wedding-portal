#!/usr/bin/env bash
# ===========================================================================
# Wedding Portal — Docker-native deployment orchestrator
#
# Replaces the previous bare-metal (uvicorn PID / npm dev) deploy path with a
# docker-compose orchestration that:
#   1. checks out the requested git revision,
#   2. validates that required secrets are present,
#   3. builds images tagged by git SHA (immutable, for rollback),
#   4. brings the stack down (KEEPING volumes) and back up,
#   5. polls until every service reports `healthy` (or rolls back),
#   6. applies pending incremental SQL migrations,
#   7. records current/previous image tags for one-command rollback,
#   8. captures compose logs on any failure.
#
# Compose enforces startup ordering via health checks
# (postgresql healthy -> backend healthy -> frontend). This script does NOT
# sequence services itself; it polls for the terminal healthy state.
#
# Commands:
#   deploy.sh deploy     Build + roll out the requested revision (auto-rollback)
#   deploy.sh rollback   Re-up the previously-deployed image tag
#   deploy.sh status     Show recorded tags + live container/health state
#   deploy.sh logs       Tail compose logs for the current stack
#
# Environment (all optional unless noted):
#   DEPLOY_ENVIRONMENT   staging | production (default: production)
#   DEPLOY_BRANCH        Git branch to fetch (default: main)
#   DEPLOY_REVISION      Git revision to check out (default: origin/$DEPLOY_BRANCH)
#   DEPLOY_SKIP_GIT      1 to skip git fetch/checkout (CI already checked out)
#   DEPLOY_SKIP_BUILD    1 to skip image build (e.g. rollback to a built tag)
#   IMAGE_TAG            Override the per-release image tag (default: git short SHA)
#   HEALTH_TIMEOUT       Seconds to wait for stack health (default: 180)
#   HEALTH_INTERVAL      Seconds between health polls (default: 5)
#   FRONTEND_HOST_PORT   Host port for the frontend (staging only; default: 80)
#   DRY_RUN=1            Print the commands instead of executing them.
#
# Required secrets (must be exported / present in .env): POSTGRES_PASSWORD,
# JWT_SECRET, API_KEY_SECRET, SESSION_SECRET_KEY.
# ===========================================================================

set -Eeuo pipefail

# --- Paths ----------------------------------------------------------------
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PRODUCTION_DIR="$APP_DIR/production"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-$PRODUCTION_DIR/.deploy}"
LOG_DIR="${LOG_DIR:-$PRODUCTION_DIR/logs}"
DEPLOY_LOG_FILE="${DEPLOY_LOG_FILE:-$LOG_DIR/deploy.log}"
FAILURE_LOG_FILE="${FAILURE_LOG_FILE:-/tmp/deploy-failure.log}"

CURRENT_TAG_FILE="$DEPLOY_STATE_DIR/current_image_tag"
PREVIOUS_TAG_FILE="$DEPLOY_STATE_DIR/previous_image_tag"

# --- Config ---------------------------------------------------------------
DEPLOY_ENVIRONMENT="${DEPLOY_ENVIRONMENT:-production}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_REVISION="${DEPLOY_REVISION:-origin/$DEPLOY_BRANCH}"
DEPLOY_SKIP_GIT="${DEPLOY_SKIP_GIT:-0}"
DEPLOY_SKIP_BUILD="${DEPLOY_SKIP_BUILD:-0}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"
FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT:-80}"
DRY_RUN="${DRY_RUN:-0}"

# Services in dependency order (must match docker-compose service names).
SERVICES=(postgresql backend frontend)

# Required secrets — deploy aborts loudly if any are missing.
REQUIRED_SECRETS=(POSTGRES_PASSWORD JWT_SECRET API_KEY_SECRET SESSION_SECRET_KEY)

# Resolved lazily once docker is confirmed available.
DOCKER_COMPOSE=()
COMPOSE_FILES=()

# ---------------------------------------------------------------------------
# Logging — every line is timestamped and tee'd to the deploy log file.
# ---------------------------------------------------------------------------
log() {
  local ts
  ts="$(date '+%Y-%m-%dT%H:%M:%S%z')"
  printf '[deploy %s] %s\n' "$ts" "$*" | tee -a "$DEPLOY_LOG_FILE" >&2
}

die() {
  log "ERROR: $*"
  exit 1
}

# Trap any unexpected error so we always capture context. The deploy() function
# handles its own rollback; this is the last-resort net for everything else.
on_error() {
  local exit_code=$?
  local line=${1:-?}
  log "Unexpected failure (exit $exit_code) at line $line"
  exit "$exit_code"
}
trap 'on_error $LINENO' ERR

# ---------------------------------------------------------------------------
# run — execute a command, or print it (redacting nothing secret is passed on
# the command line; secrets travel via the environment, not argv) under DRY_RUN.
# ---------------------------------------------------------------------------
run() {
  if [ "$DRY_RUN" = "1" ]; then
    local rendered=""
    local arg
    for arg in "$@"; do
      rendered+=" $(printf '%q' "$arg")"
    done
    log "[dry-run]${rendered}"
    return 0
  fi
  "$@"
}

compose() {
  run "${DOCKER_COMPOSE[@]}" "${COMPOSE_FILES[@]}" "$@"
}

# A non-dry-run compose call that *captures* output (for `ps -q`, inspect, etc.).
compose_q() {
  if [ "$DRY_RUN" = "1" ]; then
    return 0
  fi
  "${DOCKER_COMPOSE[@]}" "${COMPOSE_FILES[@]}" "$@"
}

usage() {
  sed -n '2,46p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

# ---------------------------------------------------------------------------
# Setup & validation
# ---------------------------------------------------------------------------
resolve_compose_command() {
  # Prefer the Compose v2 plugin (`docker compose`); fall back to the legacy
  # standalone binary (`docker-compose`). Production override needs v2.24+
  # for the `!reset []` tag.
  if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE=(docker-compose)
  else
    die "Neither 'docker compose' nor 'docker-compose' is available on PATH."
  fi
  log "Using compose command: ${DOCKER_COMPOSE[*]}"
}

resolve_compose_files() {
  COMPOSE_FILES=(-f docker-compose.yml)
  if [ "$DEPLOY_ENVIRONMENT" = "production" ]; then
    COMPOSE_FILES+=(-f docker-compose.prod.yml)
    # Isolate the production compose PROJECT from staging on the shared host, so
    # their compose state/metadata never collide. Combined with the prod
    # override's distinct container/volume/network names, this keeps the two
    # stacks fully separate (and staging keeps its default project name).
    export COMPOSE_PROJECT_NAME="wedding-prod"
  fi
  log "Environment: $DEPLOY_ENVIRONMENT (compose files: ${COMPOSE_FILES[*]}${COMPOSE_PROJECT_NAME:+ project: $COMPOSE_PROJECT_NAME})"
}

check_prerequisites() {
  command -v docker >/dev/null 2>&1 || die "docker is not installed or not on PATH."
  if [ "$DRY_RUN" != "1" ]; then
    docker info >/dev/null 2>&1 || die "Docker daemon is not reachable (is it running / do you have permission?)."
  fi
  [ -f "$PRODUCTION_DIR/docker-compose.yml" ] || die "Missing $PRODUCTION_DIR/docker-compose.yml"
  if [ "$DEPLOY_ENVIRONMENT" = "production" ]; then
    [ -f "$PRODUCTION_DIR/docker-compose.prod.yml" ] || die "Missing $PRODUCTION_DIR/docker-compose.prod.yml"
  fi
}

# Load .env (if present) so secrets are available even outside CI. In CI the
# secrets are already exported into the environment; an absent .env is fine.
load_env_file() {
  local env_file="$PRODUCTION_DIR/.env"
  if [ -f "$env_file" ]; then
    log "Loading environment from $env_file"
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  else
    log "No .env at $env_file; relying on the exported environment (CI mode)."
  fi
}

validate_secrets() {
  local missing=()
  local name
  for name in "${REQUIRED_SECRETS[@]}"; do
    if [ -z "${!name:-}" ]; then
      missing+=("$name")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    die "Missing required secret(s): ${missing[*]}. Set them via .env or the CI environment."
  fi
  log "All required secrets present."
}

# ---------------------------------------------------------------------------
# Git operations
# ---------------------------------------------------------------------------
checkout_revision() {
  if [ "$DEPLOY_SKIP_GIT" = "1" ]; then
    log "DEPLOY_SKIP_GIT=1 — skipping git fetch/checkout (using working tree as-is)."
    return 0
  fi
  cd "$APP_DIR"
  log "Fetching origin/$DEPLOY_BRANCH"
  run git fetch origin "$DEPLOY_BRANCH"
  log "Checking out $DEPLOY_REVISION"
  run git checkout --force "$DEPLOY_REVISION"
}

resolve_image_tag() {
  # Immutable, per-release tag. Defaults to the git short SHA so rollback can
  # re-up a previous tag without rebuilding. Fall back to a timestamp if git is
  # unavailable (e.g. tarball deploy).
  if [ -n "${IMAGE_TAG:-}" ] && [ "$IMAGE_TAG" != "latest" ]; then
    log "Using caller-provided IMAGE_TAG=$IMAGE_TAG"
    return 0
  fi
  local sha=""
  if sha="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null)"; then
    IMAGE_TAG="$sha"
  else
    IMAGE_TAG="$(date '+%Y%m%d-%H%M%S')"
  fi
  export IMAGE_TAG
  log "Release IMAGE_TAG=$IMAGE_TAG"
}

# ---------------------------------------------------------------------------
# Health polling — wait for the terminal `healthy` state of every service.
# Returns 0 when all healthy; non-zero on timeout or container exit.
# ---------------------------------------------------------------------------
wait_healthy() {
  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] skipping health poll"
    return 0
  fi

  local deadline=$((SECONDS + HEALTH_TIMEOUT))
  local attempt=0
  while [ "$SECONDS" -lt "$deadline" ]; do
    attempt=$((attempt + 1))
    local all_ok=1
    local svc cid state
    for svc in "${SERVICES[@]}"; do
      cid="$(compose_q ps -q "$svc" 2>/dev/null || true)"
      if [ -z "$cid" ]; then
        all_ok=0
        state="(no container)"
      else
        # A container without a healthcheck reports no .State.Health; treat a
        # running-without-healthcheck container as healthy, an exited one as bad.
        state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo unknown)"
        case "$state" in
          healthy|running) ;;            # ok
          *) all_ok=0 ;;
        esac
        # Hard-fail fast if a container has exited/crashed — no point waiting.
        if [ "$state" = "exited" ] || [ "$state" = "dead" ]; then
          log "Service '$svc' is '$state' — aborting health wait."
          return 1
        fi
      fi
      [ "$all_ok" = 1 ] || break
    done

    if [ "$all_ok" = 1 ]; then
      log "All services healthy."
      return 0
    fi

    local remaining=$((deadline - SECONDS))
    log "Waiting for services (attempt $attempt; last='$state'; ${remaining}s left)..."
    sleep "$HEALTH_INTERVAL"
  done

  log "Stack did not become healthy within ${HEALTH_TIMEOUT}s."
  return 1
}

# End-to-end endpoint smoke test. Only meaningful in staging where host ports
# are published; production publishes none (Traefik fronts the frontend), so we
# skip it there and rely on container health.
verify_endpoints() {
  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] skipping endpoint verification"
    return 0
  fi
  if [ "$DEPLOY_ENVIRONMENT" = "production" ]; then
    log "Production: skipping host-port curl checks (no published ports; Traefik fronts the stack)."
    return 0
  fi
  command -v curl >/dev/null 2>&1 || { log "curl unavailable; skipping endpoint verification."; return 0; }

  local backend_url="http://localhost:3001/health"
  local frontend_url="http://localhost:${FRONTEND_HOST_PORT}/healthz"

  log "Verifying backend endpoint: $backend_url"
  curl --fail --silent --show-error --max-time 10 "$backend_url" >/dev/null \
    || die "Backend endpoint $backend_url did not respond OK."

  log "Verifying frontend endpoint: $frontend_url"
  curl --fail --silent --show-error --max-time 10 "$frontend_url" >/dev/null \
    || die "Frontend endpoint $frontend_url did not respond OK."

  log "Endpoint verification passed."
}

# ---------------------------------------------------------------------------
# Incremental SQL migrations — applied against the running postgres container
# AFTER the DB is healthy. schema.sql runs only on first boot via initdb; these
# numbered files are not auto-applied. We track applied files in a
# schema_migrations table so reruns are safe (idempotent across deploys).
# ---------------------------------------------------------------------------
apply_migrations() {
  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] skipping migrations"
    return 0
  fi

  local migrations_dir="$PRODUCTION_DIR/database/migrations"
  if [ ! -d "$migrations_dir" ]; then
    log "No migrations directory; skipping."
    return 0
  fi

  local db_user="${POSTGRES_USER:-wedding}"
  local db_name="${POSTGRES_DB:-wedding_dev}"

  log "Ensuring schema_migrations tracking table exists."
  compose_q exec -T postgresql \
    psql -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 -c \
    "CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());" \
    || die "Could not create schema_migrations table."

  local applied
  local f base
  for f in "$migrations_dir"/[0-9]*.sql; do
    [ -e "$f" ] || continue
    base="$(basename "$f")"
    applied="$(compose_q exec -T postgresql \
      psql -U "$db_user" -d "$db_name" -tAc \
      "SELECT 1 FROM schema_migrations WHERE filename = '$base';" 2>/dev/null | tr -d '[:space:]')"
    if [ "$applied" = "1" ]; then
      log "Migration already applied: $base"
      continue
    fi
    log "Applying migration: $base"
    compose_q exec -T postgresql \
      psql -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 -f - < "$f" \
      || die "Migration failed: $base"
    compose_q exec -T postgresql \
      psql -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 -c \
      "INSERT INTO schema_migrations (filename) VALUES ('$base') ON CONFLICT DO NOTHING;" \
      || die "Could not record migration: $base"
  done
  log "Migrations up to date."
}

# ---------------------------------------------------------------------------
# Reconcile the application DB role's password to the current POSTGRES_PASSWORD
# secret. Postgres only applies POSTGRES_PASSWORD on first volume init, so once
# the data volume exists a rotated secret leaves the role on its OLD password
# and the backend can no longer authenticate — every DB query fails even though
# the container reports "healthy" (liveness does not touch the DB). Re-running
# an idempotent ALTER USER over the local-socket trust path (the same path
# migrations use, so it works regardless of the role's current password) keeps
# the role password in sync on every deploy. Safe to run repeatedly.
# ---------------------------------------------------------------------------
reconcile_db_password() {
  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] skipping DB role password reconciliation"
    return 0
  fi

  local db_user="${POSTGRES_USER:-wedding}"
  local db_name="${POSTGRES_DB:-wedding_dev}"

  [ -n "${POSTGRES_PASSWORD:-}" ] \
    || die "POSTGRES_PASSWORD is empty; cannot reconcile DB role password."

  # Single-quote-escape the secret (double any embedded single quotes) so it can
  # be embedded safely as a SQL string literal. psql does not interpolate :'var'
  # in -c command strings, so we build the literal here instead. The secret is
  # not written to the log (only this message is).
  local pw_escaped="${POSTGRES_PASSWORD//\'/\'\'}"
  log "Reconciling '$db_user' role password to the current secret."
  compose_q exec -T postgresql \
    psql -U "$db_user" -d "$db_name" -v ON_ERROR_STOP=1 \
    -c "ALTER USER \"$db_user\" WITH PASSWORD '$pw_escaped';" >/dev/null \
    || die "Could not reconcile DB role password."
}

# ---------------------------------------------------------------------------
# Rollback state
# ---------------------------------------------------------------------------
record_tags() {
  local previous_tag="$1"
  local current_tag="$2"
  if [ "$DRY_RUN" = "1" ]; then
    log "[dry-run] would record current=$current_tag previous=$previous_tag"
    return 0
  fi
  mkdir -p "$DEPLOY_STATE_DIR"
  if [ -n "$previous_tag" ]; then
    printf '%s\n' "$previous_tag" > "$PREVIOUS_TAG_FILE"
  fi
  printf '%s\n' "$current_tag" > "$CURRENT_TAG_FILE"
  log "Recorded image tags: current=$current_tag previous=${previous_tag:-<none>}"
}

read_current_tag() {
  [ -f "$CURRENT_TAG_FILE" ] && cat "$CURRENT_TAG_FILE" || true
}

read_previous_tag() {
  [ -f "$PREVIOUS_TAG_FILE" ] && cat "$PREVIOUS_TAG_FILE" || true
}

capture_failure_logs() {
  if [ "$DRY_RUN" = "1" ]; then
    return 0
  fi
  log "Capturing compose logs to $FAILURE_LOG_FILE"
  { compose_q ps; echo '--- logs ---'; compose_q logs --no-color --tail=500; } \
    > "$FAILURE_LOG_FILE" 2>&1 || true
  log "Failure logs written to $FAILURE_LOG_FILE"
}

# Bring the stack up on a known-good previous tag. Used by both the auto-
# rollback path and the explicit `rollback` command.
rollback_to_tag() {
  local tag="$1"
  [ -n "$tag" ] || die "No image tag supplied for rollback."
  log "Rolling back to image tag: $tag"
  export IMAGE_TAG="$tag"
  compose up -d
  if wait_healthy; then
    log "Rollback to $tag is healthy."
    # The rolled-back tag is now current; we do NOT shift previous (the bad tag
    # should not become a rollback target).
    record_tags "$(read_previous_tag)" "$tag"
    return 0
  fi
  capture_failure_logs
  die "Rollback to $tag is ALSO unhealthy — manual intervention required (page a human)."
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
deploy() {
  log "=== Deploy start: env=$DEPLOY_ENVIRONMENT revision=$DEPLOY_REVISION ==="

  local previous_tag
  previous_tag="$(read_current_tag)"   # the tag currently serving (rollback target)

  checkout_revision
  resolve_image_tag                    # sets/export IMAGE_TAG (the new release)

  cd "$PRODUCTION_DIR"

  if [ "$DEPLOY_SKIP_BUILD" = "1" ]; then
    log "DEPLOY_SKIP_BUILD=1 — skipping image build."
  else
    log "Building images (IMAGE_TAG=$IMAGE_TAG)"
    compose build || { capture_failure_logs; die "Image build failed."; }
  fi

  log "Stopping old containers (volumes preserved)."
  compose down

  log "Starting new stack (detached)."
  compose up -d

  log "Container summary:"
  compose ps || true

  if ! wait_healthy; then
    capture_failure_logs
    if [ -n "$previous_tag" ] && [ "$previous_tag" != "$IMAGE_TAG" ]; then
      log "Health checks failed — auto-rolling back to previous tag '$previous_tag'."
      rollback_to_tag "$previous_tag"
      die "Deploy of $IMAGE_TAG failed health checks; rolled back to $previous_tag."
    fi
    die "Deploy of $IMAGE_TAG failed health checks and no previous tag exists to roll back to."
  fi

  reconcile_db_password

  apply_migrations

  verify_endpoints

  record_tags "$previous_tag" "$IMAGE_TAG"
  log "=== Deploy complete: $IMAGE_TAG (previous: ${previous_tag:-<none>}) ==="
}

rollback() {
  log "=== Rollback requested ==="
  local previous_tag
  previous_tag="$(read_previous_tag)"
  [ -n "$previous_tag" ] || die "No previous image tag recorded ($PREVIOUS_TAG_FILE); nothing to roll back to."
  cd "$PRODUCTION_DIR"
  rollback_to_tag "$previous_tag"
  log "=== Rollback complete: now serving $previous_tag ==="
}

status() {
  log "App directory:        $APP_DIR"
  log "Environment:          $DEPLOY_ENVIRONMENT"
  log "Current image tag:    $(read_current_tag || echo '<none>')"
  log "Previous image tag:   $(read_previous_tag || echo '<none>')"
  if command -v git >/dev/null 2>&1; then
    log "Git HEAD:             $(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo '<unknown>')"
  fi
  cd "$PRODUCTION_DIR"
  log "Container / health state:"
  compose_q ps || true
}

logs_cmd() {
  cd "$PRODUCTION_DIR"
  compose logs --tail=200 -f
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
main() {
  mkdir -p "$LOG_DIR" "$DEPLOY_STATE_DIR"

  local command="${1:-deploy}"

  # Help needs no docker/secret setup.
  case "$command" in
    -h|--help|help)
      usage
      return 0
      ;;
  esac

  resolve_compose_command
  resolve_compose_files
  check_prerequisites
  load_env_file
  validate_secrets

  case "$command" in
    deploy)   deploy ;;
    rollback) rollback ;;
    status)   status ;;
    logs)     logs_cmd ;;
    *)
      log "Unknown command: $command"
      usage
      exit 2
      ;;
  esac
}

main "$@"

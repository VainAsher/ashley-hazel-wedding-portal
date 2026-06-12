#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BACKEND_DIR="$APP_DIR/production/backend"
FRONTEND_DIR="$APP_DIR/production/frontend"
DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-$APP_DIR/.deploy}"
PREVIOUS_REVISION_FILE="$DEPLOY_STATE_DIR/previous_revision"
CURRENT_REVISION_FILE="$DEPLOY_STATE_DIR/current_revision"
BACKEND_LOG_FILE="${BACKEND_LOG_FILE:-/tmp/wedding-dashboard-backend.log}"
BACKEND_PID_FILE="${BACKEND_PID_FILE:-/tmp/wedding-dashboard-backend.pid}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:3001/api/guests}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-}"
FRONTEND_DEPLOY_DIR="${FRONTEND_DEPLOY_DIR:-}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_ENVIRONMENT="${DEPLOY_ENVIRONMENT:-production}"
DEPLOY_FRONTEND_BUILD="${DEPLOY_FRONTEND_BUILD:-1}"
DEPLOY_REVISION="${DEPLOY_REVISION:-origin/$DEPLOY_BRANCH}"
DRY_RUN="${DRY_RUN:-0}"

log() {
  printf '[deploy] %s\n' "$*"
}

redact_arg() {
  local arg="$1"

  if [ -n "${DATABASE_URL:-}" ] && [ "$arg" = "$DATABASE_URL" ]; then
    printf '$DATABASE_URL'
    return 0
  fi

  case "$arg" in
    postgresql://*@*|postgres://*@*)
      printf '<database-url>'
      ;;
    *)
      printf '%q' "$arg"
      ;;
  esac
}

run() {
  if [ "$DRY_RUN" = "1" ]; then
    printf '[dry-run] '
    redact_arg "$1"
    shift || true
    for arg in "$@"; do
      printf ' '
      redact_arg "$arg"
    done
    printf '\n'
    return 0
  fi

  "$@"
}

usage() {
  cat <<'USAGE'
Usage:
  production/scripts/deploy.sh deploy
  production/scripts/deploy.sh rollback
  production/scripts/deploy.sh status

Environment:
  DEPLOY_REVISION       Git revision to deploy. Defaults to origin/main.
  DEPLOY_BRANCH         Git branch to fetch. Defaults to main.
  DEPLOY_ENVIRONMENT    staging or production label for logs. Defaults to production.
  BACKEND_HEALTH_URL    Backend smoke-test URL. Defaults to http://127.0.0.1:3001/api/guests.
  FRONTEND_HEALTH_URL   Optional frontend smoke-test URL.
  FRONTEND_DEPLOY_DIR   Optional directory to receive built frontend assets.
  DRY_RUN=1             Print commands without changing the server.
USAGE
}

require_file() {
  local path="$1"
  local description="$2"

  if [ ! -f "$path" ]; then
    log "Missing $description: $path"
    exit 1
  fi
}

source_backend_env() {
  require_file "$BACKEND_DIR/.env" "backend environment file"
  set -a
  # shellcheck disable=SC1091
  source "$BACKEND_DIR/.env"
  set +a
}

record_revision_state() {
  local previous_revision="$1"
  local deployed_revision="$2"

  if [ "$DRY_RUN" = "1" ]; then
    log "Dry run: skipping deployment state update"
    return 0
  fi

  mkdir -p "$DEPLOY_STATE_DIR"
  printf '%s\n' "$previous_revision" > "$PREVIOUS_REVISION_FILE"
  printf '%s\n' "$deployed_revision" > "$CURRENT_REVISION_FILE"
}

checkout_revision() {
  local revision="$1"

  cd "$APP_DIR"
  log "Fetching origin/$DEPLOY_BRANCH"
  run git fetch origin "$DEPLOY_BRANCH"
  log "Checking out $revision"
  run git checkout --force "$revision"
}

install_backend_dependencies() {
  log "Installing backend dependencies"
  cd "$BACKEND_DIR"

  if [ ! -x "venv/bin/python" ]; then
    run python3 -m venv venv
  fi

  run venv/bin/python -m pip install --upgrade pip
  run venv/bin/python -m pip install -r requirements.txt
}

apply_database_migrations() {
  log "Applying database migrations"
  source_backend_env

  if [ -z "${DATABASE_URL:-}" ]; then
    log "DATABASE_URL is not set after loading $BACKEND_DIR/.env"
    exit 1
  fi

  for migration in "$APP_DIR"/production/database/migrations/[0-9]*.sql; do
    [ -e "$migration" ] || continue
    log "Applying $(basename "$migration")"
    run psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
  done
}

stop_backend() {
  local pid=""

  if [ -f "$BACKEND_PID_FILE" ]; then
    pid="$(cat "$BACKEND_PID_FILE")"
  fi

  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    log "Stopping backend pid $pid"
    run kill "$pid"
    sleep 1
  fi

  while read -r process_pid; do
    [ -n "$process_pid" ] || continue
    log "Stopping legacy backend pid $process_pid"
    run kill "$process_pid" 2>/dev/null || true
  done < <(
    {
      pgrep -f "$BACKEND_DIR/venv/bin/python main.py" || true
      pgrep -f "venv/bin/python main.py" || true
    } | sort -u
  )
}

start_backend() {
  log "Starting backend"
  cd "$BACKEND_DIR"
  run setsid -f venv/bin/python main.py > "$BACKEND_LOG_FILE" 2>&1 < /dev/null

  if [ "$DRY_RUN" = "1" ]; then
    log "Dry run: skipping backend start verification"
    return 0
  fi

  sleep 1

  local pid
  pid="$(
    {
      pgrep -f "$BACKEND_DIR/venv/bin/python main.py" || true
      pgrep -f "venv/bin/python main.py" || true
    } | sort -u | tail -n 1
  )"
  if [ -z "$pid" ]; then
    log "Backend did not start. Recent log output:"
    tail -n 80 "$BACKEND_LOG_FILE" || true
    exit 1
  fi

  printf '%s\n' "$pid" > "$BACKEND_PID_FILE"
  log "Backend started as pid $pid"
}

build_frontend() {
  if [ "$DEPLOY_FRONTEND_BUILD" != "1" ]; then
    log "Skipping frontend build"
    return 0
  fi

  log "Building frontend"
  cd "$FRONTEND_DIR"
  run npm ci
  run npm run build

  if [ -n "$FRONTEND_DEPLOY_DIR" ]; then
    log "Copying frontend assets to $FRONTEND_DEPLOY_DIR"
    run mkdir -p "$FRONTEND_DEPLOY_DIR"
    run rsync -a --delete dist/ "$FRONTEND_DEPLOY_DIR"/
  fi
}

health_check() {
  log "Checking backend health: $BACKEND_HEALTH_URL"
  run curl --fail --silent --show-error "$BACKEND_HEALTH_URL" >/dev/null

  if [ -n "$FRONTEND_HEALTH_URL" ]; then
    log "Checking frontend health: $FRONTEND_HEALTH_URL"
    run curl --fail --silent --show-error "$FRONTEND_HEALTH_URL" >/dev/null
  fi
}

deploy() {
  local previous_revision
  previous_revision="$(git -C "$APP_DIR" rev-parse HEAD)"

  log "Deploying $DEPLOY_ENVIRONMENT revision $DEPLOY_REVISION"
  checkout_revision "$DEPLOY_REVISION"
  local deployed_revision
  deployed_revision="$(git -C "$APP_DIR" rev-parse HEAD)"

  install_backend_dependencies
  apply_database_migrations
  stop_backend
  start_backend
  build_frontend
  health_check
  record_revision_state "$previous_revision" "$deployed_revision"

  log "Deployment complete: $deployed_revision"
}

rollback() {
  require_file "$PREVIOUS_REVISION_FILE" "previous deployment revision"
  DEPLOY_REVISION="$(cat "$PREVIOUS_REVISION_FILE")"
  log "Rolling back to $DEPLOY_REVISION"
  deploy
}

status() {
  log "Application directory: $APP_DIR"
  log "Current revision: $(git -C "$APP_DIR" rev-parse HEAD)"
  if [ -f "$CURRENT_REVISION_FILE" ]; then
    log "Last deployed revision: $(cat "$CURRENT_REVISION_FILE")"
  fi
  if [ -f "$PREVIOUS_REVISION_FILE" ]; then
    log "Rollback revision: $(cat "$PREVIOUS_REVISION_FILE")"
  fi
  if [ -f "$BACKEND_PID_FILE" ]; then
    log "Backend pid file: $(cat "$BACKEND_PID_FILE")"
  fi
  health_check
}

main() {
  local command="${1:-deploy}"

  case "$command" in
    deploy)
      deploy
      ;;
    rollback)
      rollback
      ;;
    status)
      status
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      log "Unknown command: $command"
      usage
      exit 2
      ;;
  esac
}

main "$@"

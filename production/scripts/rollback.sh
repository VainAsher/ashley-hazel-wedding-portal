#!/usr/bin/env bash
# ===========================================================================
# Wedding Portal — rollback convenience wrapper
#
# Thin wrapper around `deploy.sh rollback`. All rollback logic (reading the
# previous image tag, re-upping the stack, polling health, re-recording state)
# lives in deploy.sh so there is a single source of truth. This script exists
# so operators / CI can call a self-documenting `rollback.sh` directly.
#
# Rollback re-ups the PREVIOUS immutable image tag (recorded after the last
# successful deploy in production/.deploy/previous_image_tag). No rebuild is
# performed — the previous images must still exist locally.
#
# Usage:
#   production/scripts/rollback.sh
#
# Honours the same environment as deploy.sh (DEPLOY_ENVIRONMENT, HEALTH_TIMEOUT,
# DRY_RUN, etc.).
# ===========================================================================

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/deploy.sh" rollback "$@"

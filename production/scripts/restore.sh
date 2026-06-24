#!/usr/bin/env bash
# ===========================================================================
# Restore a production dump (from backup.sh) into a target database.
#
# DEFAULT target is a THROWAWAY database (wedding_restore_test) — for periodic
# restore drills that prove the backups are usable WITHOUT touching live data.
# Pass `wedding_prod` as the target only for a real recovery.
#
# Usage:
#   restore.sh <dump.sql.gz> [target_db=wedding_restore_test]
#
# Config via env: PROD_DB_CONTAINER (default wedding-prod-postgresql),
#                 POSTGRES_USER (default wedding).
# ===========================================================================
set -euo pipefail

CONTAINER="${PROD_DB_CONTAINER:-wedding-prod-postgresql}"
DB_USER="${POSTGRES_USER:-wedding}"
DUMP="${1:-}"
TARGET="${2:-wedding_restore_test}"

if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "usage: restore.sh <dump.sql.gz> [target_db=wedding_restore_test]" >&2
  exit 2
fi

echo "[restore] restoring '${DUMP}' into db '${TARGET}' (container ${CONTAINER})"
if [ "$TARGET" = "wedding_prod" ]; then
  echo "[restore] !!! TARGET IS THE LIVE PRODUCTION DATABASE. Ctrl-C within 5s to abort." >&2
  sleep 5
fi

# (Re)create the target db for a clean restore.
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS ${TARGET};" \
  -c "CREATE DATABASE ${TARGET} OWNER ${DB_USER};"

gunzip -c "$DUMP" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$TARGET" -v ON_ERROR_STOP=1

echo "[restore] done -> ${TARGET}."
if [ "$TARGET" != "wedding_prod" ]; then
  echo "[restore] verify the data, then drop the throwaway db:"
  echo "  docker exec ${CONTAINER} psql -U ${DB_USER} -d postgres -c 'DROP DATABASE ${TARGET};'"
fi

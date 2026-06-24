#!/usr/bin/env bash
# ===========================================================================
# Nightly logical backup of the PRODUCTION wedding database.
#
# Runs `pg_dump` inside the prod Postgres container (local-socket trust — no
# password needed), gzips it into a prod-only backups directory, verifies it,
# prunes old dumps, and (optionally) copies it offsite to the NAS.
#
# This complements the VM-level PBS snapshots with granular, portable, logical
# dumps. Schedule it on the PRODUCTION host (.32) via a systemd timer or cron,
# e.g. nightly:  0 3 * * *  /home/deploy/wedding-prod/production/scripts/backup.sh
#
# Config via env (sensible defaults):
#   PROD_DB_CONTAINER     default wedding-prod-postgresql
#   POSTGRES_DB           default wedding_prod
#   POSTGRES_USER         default wedding
#   PROD_BACKUP_DIR       default /home/deploy/wedding-prod-backups
#   BACKUP_RETENTION_DAYS default 14
#   BACKUP_OFFSITE_DEST   e.g. deploy@192.168.0.176:/mnt/tank/backups/wedding (NAS; set once resized)
# ===========================================================================
set -euo pipefail

CONTAINER="${PROD_DB_CONTAINER:-wedding-prod-postgresql}"
DB_NAME="${POSTGRES_DB:-wedding_prod}"
DB_USER="${POSTGRES_USER:-wedding}"
BACKUP_DIR="${PROD_BACKUP_DIR:-/home/deploy/wedding-prod-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
OFFSITE_DEST="${BACKUP_OFFSITE_DEST:-}"

ts="$(date +%Y%m%d-%H%M%S)"
out="${BACKUP_DIR}/wedding_prod-${ts}.sql.gz"

mkdir -p "$BACKUP_DIR"
echo "[backup] dumping ${DB_NAME} from ${CONTAINER} -> ${out}"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --clean --if-exists \
  | gzip -c > "$out"

# Integrity: valid gzip and not suspiciously tiny.
gzip -t "$out"
size="$(stat -c%s "$out" 2>/dev/null || stat -f%z "$out")"
if [ "${size:-0}" -le 100 ]; then
  echo "[backup] ERROR: dump suspiciously small (${size} bytes) — failing." >&2
  exit 1
fi
echo "[backup] ok: ${out} (${size} bytes)"

# Offsite copy (optional until the NAS is resized).
if [ -n "$OFFSITE_DEST" ]; then
  echo "[backup] copying offsite -> ${OFFSITE_DEST}"
  rsync -a "$out" "${OFFSITE_DEST%/}/"
fi

# Prune local dumps older than the retention window.
find "$BACKUP_DIR" -name 'wedding_prod-*.sql.gz' -type f -mtime +"${RETENTION_DAYS}" -print -delete
echo "[backup] done."

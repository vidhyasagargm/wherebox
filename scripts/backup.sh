#!/bin/sh
# Runs in the backup container: once a day, copy PocketBase's latest snapshots
# (pb_data/backups) to the restic repository, encrypted, and keep 30 days.
#   docker compose run --rm backup now        back up right away
#   docker compose run --rm backup snapshots  list backups
set -eu

: "${RESTIC_REPOSITORY:?Set RESTIC_REPOSITORY in .env}"
: "${RESTIC_PASSWORD:?Set RESTIC_PASSWORD in .env}"

log() { echo "[backup] $(date -u '+%Y-%m-%d %H:%M:%S') $*"; }

ensure_repo() {
  if ! restic cat config >/dev/null 2>&1; then
    log "creating repository $RESTIC_REPOSITORY"
    restic init
  fi
}

run_backup() {
  if ! ls /pb_data/backups/*.zip >/dev/null 2>&1; then
    log "no snapshot in /pb_data/backups yet (PocketBase makes one at 02:30 UTC); skipping"
    return 0
  fi
  restic backup /pb_data/backups --tag wherebox --host wherebox
  restic forget --tag wherebox --keep-daily 30 --prune
  restic check
  log "done"
}

case "${1:-loop}" in
  now)
    ensure_repo
    run_backup
    ;;
  snapshots)
    restic snapshots
    ;;
  loop)
    ensure_repo
    TIME="${BACKUP_TIME:-03:15}"
    log "daily backup at $TIME UTC to $RESTIC_REPOSITORY"
    while true; do
      now=$(date -u +%s)
      next=$(date -u -d "$(date -u +%Y-%m-%d) $TIME" +%s)
      [ "$next" -le "$now" ] && next=$((next + 86400))
      sleep $((next - now))
      run_backup || log "backup FAILED, will retry tomorrow"
    done
    ;;
  *)
    exec restic "$@"
    ;;
esac

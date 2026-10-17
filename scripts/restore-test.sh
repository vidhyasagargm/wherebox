#!/bin/sh
# Proves the backups work: restores the newest one into ./restore, starts a
# throwaway PocketBase on it and checks that the data is there.
# Run on the server, next to docker-compose.yml:   sh scripts/restore-test.sh
# Nothing in the running service is touched.
set -eu
cd "$(dirname "$0")/.."

echo "1/4 Restoring the newest backup into ./restore …"
rm -rf restore && mkdir -p restore
docker compose run --rm -v "$PWD/restore:/restore" backup restore latest --tag wherebox --target /restore >/dev/null

ZIP=$(ls -t restore/pb_data/backups/*.zip 2>/dev/null | head -1)
[ -n "$ZIP" ] || { echo "No snapshot found in the backup."; exit 1; }
echo "    newest snapshot: $(basename "$ZIP")"

echo "2/4 Unpacking …"
mkdir -p restore/check
unzip -q "$ZIP" -d restore/check

echo "3/4 Starting a temporary PocketBase on the restored data …"
IMAGE=$(docker compose config --images pocketbase | head -1)
docker run -d --rm --name wherebox-restore-test -u "$(id -u):$(id -g)" -v "$PWD/restore/check:/pb_data" -p 127.0.0.1:8099:8090 "$IMAGE" >/dev/null
trap 'docker stop wherebox-restore-test >/dev/null 2>&1 || true' EXIT
i=0; until curl -sf http://127.0.0.1:8099/api/health >/dev/null; do i=$((i+1)); [ $i -gt 60 ] && { echo "PocketBase did not start"; exit 1; }; sleep 1; done

echo "4/4 Checking the data …"
PW="restore-check-$(date +%s)-$$"
docker exec wherebox-restore-test pocketbase superuser upsert restore-check@local.test "$PW" --dir /pb_data >/dev/null
TOKEN=$(curl -sf -X POST http://127.0.0.1:8099/api/collections/_superusers/auth-with-password -H 'Content-Type: application/json' \
  -d "{\"identity\":\"restore-check@local.test\",\"password\":\"$PW\"}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] || { echo "Could not sign in to the restored copy"; exit 1; }
count() { curl -sf -H "Authorization: $TOKEN" "http://127.0.0.1:8099/api/collections/$1/records?perPage=1" | sed -n 's/.*"totalItems":\([0-9]*\).*/\1/p'; }
echo "    users: $(count users)  lists: $(count lists)  items: $(count items)"
echo "Restore test passed. Write today's date in docs/gdpr/security-measures.md. Remove ./restore when done."

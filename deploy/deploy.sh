#!/usr/bin/env bash
# Rolls out one LimeOnIt release on this server, in the folder with docker-compose.yml and .env:
#
#   ./deploy.sh 1.2.0                                          a new version
#   ./deploy.sh 1.1.0 --restore /data/backups/<file>.db        back, with the database from before
#
# Pulls the image for that tag, makes a backup of the running database, starts the new version
# and waits until /healthz answers with that version. It never rolls back by itself: going back
# over a migration needs the backup too, and that is a choice. It prints the command instead.
set -euo pipefail

usage() {
  echo "Gebruik: ./deploy.sh <versie> [--restore <back-up>]   bijvoorbeeld: ./deploy.sh 1.2.0" >&2
  exit 2
}

[ $# -ge 1 ] || usage
VERSION="${1#v}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || usage
RESTORE=""
if [ $# -gt 1 ]; then
  { [ $# -eq 3 ] && [ "$2" = "--restore" ]; } || usage
  RESTORE="$3"
fi

cd "$(dirname "$0")"
[ -f .env ] || { echo "Geen .env in $(pwd). Kopieer .env.example en vul hem in." >&2; exit 1; }

PREVIOUS="$(sed -n 's/^LIMEONIT_VERSION=//p' .env | tail -n 1)"
BACKUP=""

rollback_hint() {
  if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$VERSION" ]; then
    echo "Terugrollen: ./deploy.sh $PREVIOUS${BACKUP:+ --restore $BACKUP}"
    echo "  Had deze versie geen migratie (zie RELEASE.md), dan is ./deploy.sh $PREVIOUS genoeg."
  else
    echo "Terugrollen: er draaide hier nog geen andere versie via dit script."
  fi
}

echo "→ Image ophalen: $VERSION"
LIMEONIT_VERSION="$VERSION" docker compose pull app

if [ -n "$(LIMEONIT_VERSION="${PREVIOUS:-$VERSION}" docker compose ps --status running -q app)" ]; then
  echo "→ Back-up van de draaiende database"
  BACKUP="$(LIMEONIT_VERSION="${PREVIOUS:-$VERSION}" docker compose exec -T app node build/ops/backup.js |
    sed -n 's/^✓ Backup made: //p')"
  echo "  $BACKUP"
fi

if [ -n "$RESTORE" ]; then
  echo "→ Back-up terugzetten: $RESTORE"
  LIMEONIT_VERSION="${PREVIOUS:-$VERSION}" docker compose stop app
  LIMEONIT_VERSION="$VERSION" docker compose run --rm --no-deps app node build/ops/restore.js --from "$RESTORE"
fi

# Remember the version in .env, so a later plain `up` keeps running this one.
if grep -q '^LIMEONIT_VERSION=' .env; then
  sed -i "s/^LIMEONIT_VERSION=.*/LIMEONIT_VERSION=$VERSION/" .env
else
  printf '\nLIMEONIT_VERSION=%s\n' "$VERSION" >>.env
fi

echo "→ Starten: $VERSION"
docker compose up -d app

echo "→ Wachten tot /healthz versie $VERSION meldt"
WANT="\"version\":\"${VERSION}\""
for _ in $(seq 1 45); do
  if docker compose exec -T app sh -c 'wget -qO- "http://127.0.0.1:${PORT:-3000}/healthz"' 2>/dev/null |
    grep -qF "$WANT"; then
    echo "✓ LimeOnIt $VERSION draait. Loop nu de smoke-checklist af (wiki/Deployment.md)."
    rollback_hint
    exit 0
  fi
  sleep 2
done

echo "✗ LimeOnIt $VERSION meldt zich niet binnen 90 seconden. De laatste regels van het log:" >&2
docker compose logs --tail 40 app >&2 || true
rollback_hint >&2
exit 1

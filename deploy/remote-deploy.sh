#!/usr/bin/env bash
# Runs on the live server, started over SSH by the deploy job in .github/workflows/ci.yml, after the job copied
# docker-compose.prod.yml, this folder and a fresh .env into /opt/mabeet (docs/deployment.md).
#   echo "$GITHUB_TOKEN" | ssh <server> bash /opt/mabeet/deploy/remote-deploy.sh <github-user>
# The token arrives on standard input, never on the command line, and stops working when the job ends.
set -euo pipefail
cd "$(dirname "$0")/.."

docker login ghcr.io --username "$1" --password-stdin
trap 'docker logout ghcr.io >/dev/null' EXIT
# The website, the worker and the migrations share this one image.
docker compose pull web

# A copy of the database before the new version's migrations run, so a failed one can be undone
# (docs/team/02-architecture-and-features.md, "Migrations"). The first deploy has no database yet. The newest 14 stay.
if [ -n "$(docker compose ps --status running --quiet db)" ]; then
  mkdir -p backups
  backup="backups/mabeet-$(date -u +%Y%m%d-%H%M%S).sql.gz"
  docker compose exec -T db sh -c 'pg_dump --username "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$backup.partial"
  mv "$backup.partial" "$backup"
  ls -1t backups/*.sql.gz | tail -n +15 | xargs -r rm --
fi

# The migrations run on their own first: `up` would remove the running website and worker before finding out that
# they failed. If they fail, the script stops here and the previous version keeps running.
docker compose run --rm migrate
docker compose up --detach --no-build --remove-orphans
# nginx fills in its configuration file only when it starts.
docker compose restart nginx
# Each deploy brings a new image; the ones no container uses any more would fill the disk.
docker image prune --all --force

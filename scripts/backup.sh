#!/usr/bin/env bash
# Daily database backup for the docker-compose (VPS) setup.
# Add to crontab:  0 2 * * * /opt/mirror-aesthetics/scripts/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
FILE="backups/mirror_$(date +%F_%H%M).sql.gz"
docker compose exec -T db pg_dump -U mirror mirror | gzip > "$FILE"
find backups -name 'mirror_*.sql.gz' -mtime +30 -delete   # keep 30 days
echo "Backup saved: $FILE"

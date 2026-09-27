#!/usr/bin/env bash

set -Eeuo pipefail

CONFIG_FILE=/etc/campus-event/config.env
COMPOSE_FILE=docker-compose.production.yml
RUNTIME_DIR=/run/campus-event
POSTGRES_PASSWORD_FILE="$RUNTIME_DIR/postgres-password"

usage() {
  echo "Usage: ./scripts/deploy.sh <git-ref>"
}

require_config() {
  local variable
  for variable in KEY_VAULT_NAME AZURE_AD_CLIENT_ID AZURE_AD_TENANT_ID AZURE_AD_AUDIENCE CAMPUS_LATITUDE CAMPUS_LONGITUDE; do
    if [[ -z "${!variable:-}" ]]; then
      echo "Missing required configuration: $variable" >&2
      exit 1
    fi
  done
}

cleanup_failed_deploy() {
  unset DATABASE_URL || true
  rm -f "$POSTGRES_PASSWORD_FILE"
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 1 ]]; then
  usage >&2
  exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing configuration file: $CONFIG_FILE" >&2
  exit 1
fi

set -a
# shellcheck source=/etc/campus-event/config.env
. "$CONFIG_FILE"
set +a
require_config

trap cleanup_failed_deploy ERR

az login --identity --allow-no-subscriptions >/dev/null
sudo install -d -o "$USER" -g "$USER" -m 700 "$RUNTIME_DIR"
az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name POSTGRES-PASSWORD --query value -o tsv > "$POSTGRES_PASSWORD_FILE"
chmod 600 "$POSTGRES_PASSWORD_FILE"
export POSTGRES_PASSWORD_FILE

git fetch --prune origin
git cat-file -e "$1^{commit}"
git checkout --detach "$1"

if docker image inspect campus-event-api:current >/dev/null 2>&1; then
  docker tag campus-event-api:current campus-event-api:previous
fi

docker compose -f "$COMPOSE_FILE" up -d postgres
docker compose -f "$COMPOSE_FILE" build api

sudo install -d -o "$USER" -g "$USER" -m 700 /var/backups/campus-events
if docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -U campus_events -d campus_events -tAc "SELECT to_regclass('public.users') IS NOT NULL" | grep -q t; then
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U campus_events -d campus_events -Fc > "/var/backups/campus-events/predeploy-$(date +%Y%m%d%H%M%S).dump"
fi

DATABASE_URL="$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name DATABASE-URL --query value -o tsv)"
export DATABASE_URL
docker compose -f "$COMPOSE_FILE" run --rm -e DATABASE_URL api npx prisma migrate deploy
unset DATABASE_URL
docker compose -f "$COMPOSE_FILE" up -d --no-build api
curl --fail --retry 12 --retry-delay 5 http://127.0.0.1:5000/events-api/v1/health

sudo install -m 644 systemd/campus-event.service /etc/systemd/system/campus-event.service
sudo systemctl daemon-reload
sudo systemctl enable campus-event.service

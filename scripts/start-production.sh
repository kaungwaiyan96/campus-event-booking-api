#!/usr/bin/env bash

set -Eeuo pipefail

CONFIG_FILE=/etc/campus-event/config.env
RUNTIME_DIR=/run/campus-event
POSTGRES_PASSWORD_FILE="$RUNTIME_DIR/postgres-password"

usage() {
  echo "Usage: scripts/start-production.sh"
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

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 0 ]]; then
  usage >&2
  exit 1
fi

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing configuration file: $CONFIG_FILE" >&2
  exit 1
fi

if [[ ! -d "$RUNTIME_DIR" ]]; then
  echo "Missing systemd runtime directory: $RUNTIME_DIR" >&2
  exit 1
fi

set -a
# shellcheck source=/etc/campus-event/config.env
. "$CONFIG_FILE"
set +a
require_config

az login --identity --allow-no-subscriptions >/dev/null
umask 077
az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name POSTGRES-PASSWORD --query value -o tsv > "$POSTGRES_PASSWORD_FILE"
export POSTGRES_PASSWORD_FILE

docker compose -f docker-compose.production.yml up -d
curl --fail --retry 12 --retry-delay 5 http://127.0.0.1:5000/events-api/v1/health

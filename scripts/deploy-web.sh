#!/usr/bin/env bash

set -Eeuo pipefail

HOSTNAME=campus-event-api.eastasia.cloudapp.azure.com
API_BASE_URL="https://$HOSTNAME/events-api/v1"
ENTRA_TENANT_ID=c1f3dc23-b7f8-48d3-9b5d-2b12f158f01f
ENTRA_API_SCOPE=api://d16771d8-2e37-476a-be7c-63f4ed09c819/access_as_user
ENTRA_REDIRECT_URI="https://$HOSTNAME/"
RELEASE_ROOT=/var/www/campus-event
CURRENT_LINK="$RELEASE_ROOT/current"

usage() {
  echo "Usage: ./scripts/deploy-web.sh <40-char-sha> <spa-client-id>"
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 2 ]]; then
  usage >&2
  exit 1
fi

if [[ $EUID -eq 0 ]]; then
  echo "Run this script as the deployment user, not root." >&2
  exit 1
fi

GIT_SHA="$1"
SPA_CLIENT_ID="$2"

if [[ ! "$GIT_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "The Git SHA must be exactly 40 lowercase hexadecimal characters." >&2
  exit 1
fi

if [[ ! "$SPA_CLIENT_ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
  echo "The SPA client ID must be a UUID." >&2
  exit 1
fi

REPOSITORY_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPOSITORY_ROOT"

if [[ "$(git rev-parse HEAD)" != "$GIT_SHA" ]]; then
  echo "Checked-out HEAD does not match the approved Git SHA." >&2
  exit 1
fi

RELEASE_DIR="$RELEASE_ROOT/releases/$GIT_SHA"
STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/campus-event-web-$GIT_SHA.XXXXXX")"
readonly STAGING_DIR
chmod 755 "$STAGING_DIR"

cleanup() {
  if [[ -d "$STAGING_DIR" ]]; then
    rm -rf -- "$STAGING_DIR"
  fi
}
trap cleanup EXIT

docker buildx build \
  --file web/Dockerfile \
  --target export \
  --build-arg "VITE_API_BASE_URL=$API_BASE_URL" \
  --build-arg "VITE_ENTRA_TENANT_ID=$ENTRA_TENANT_ID" \
  --build-arg "VITE_ENTRA_CLIENT_ID=$SPA_CLIENT_ID" \
  --build-arg "VITE_ENTRA_API_SCOPE=$ENTRA_API_SCOPE" \
  --build-arg "VITE_ENTRA_REDIRECT_URI=$ENTRA_REDIRECT_URI" \
  --output "type=local,dest=$STAGING_DIR" \
  web

sudo install -d -m 755 "$RELEASE_ROOT" "$RELEASE_ROOT/releases" "$RELEASE_DIR"
while IFS= read -r -d '' source_file; do
  relative_path="${source_file#"$STAGING_DIR"/}"
  target_dir="$RELEASE_DIR/$(dirname "$relative_path")"
  sudo install -d -m 755 "$target_dir"
  sudo install -m 644 "$source_file" "$target_dir/$(basename "$relative_path")"
done < <(find "$STAGING_DIR" -type f -print0)
sudo ln -sfnT "$RELEASE_DIR" "$CURRENT_LINK"
sudo nginx -t
sudo systemctl reload nginx

echo "Published web release $GIT_SHA at https://$HOSTNAME/"

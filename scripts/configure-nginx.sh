#!/usr/bin/env bash

set -Eeuo pipefail

HOSTNAME=campus-event-api.eastasia.cloudapp.azure.com
HTTP_TEMPLATE=nginx/campus-event-http.conf
HTTPS_TEMPLATE=nginx/default.conf
NGINX_SITE=/etc/nginx/sites-available/campus-event.conf
CERTIFICATE_DIR="/etc/letsencrypt/live/$HOSTNAME"

usage() {
  echo "Usage: sudo ./scripts/configure-nginx.sh <certbot-email>"
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 1 ]]; then
  usage >&2
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "This script must run as root." >&2
  exit 1
fi

public_ip="$(curl --fail --silent --show-error --max-time 5 \
  -H Metadata:true \
  'http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text')"
resolved_ips="$(getent ahostsv4 "$HOSTNAME" | awk '{print $1}' | sort -u)"

if ! grep -Fqx "$public_ip" <<< "$resolved_ips"; then
  echo "$HOSTNAME does not resolve to this VM's public IP." >&2
  exit 1
fi

install -d -m 755 /var/www/certbot
install -m 644 "$HTTP_TEMPLATE" "$NGINX_SITE"
ln -sfn "$NGINX_SITE" /etc/nginx/sites-enabled/campus-event.conf
nginx -t
systemctl reload nginx

certbot certonly --webroot -w /var/www/certbot \
  -d "$HOSTNAME" \
  --email "$1" --agree-tos --non-interactive

if [[ ! -f "$CERTIFICATE_DIR/fullchain.pem" || ! -f "$CERTIFICATE_DIR/privkey.pem" ]]; then
  echo "Certificate files were not created for $HOSTNAME." >&2
  exit 1
fi

install -m 644 "$HTTPS_TEMPLATE" "$NGINX_SITE"
nginx -t
systemctl reload nginx
certbot renew --dry-run

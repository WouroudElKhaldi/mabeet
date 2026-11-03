#!/usr/bin/env bash
# Run once on the live server, by hand, when the domain and its www point at it (docs/deployment.md, "Adding the
# domain"):
#   cd /opt/mabeet && CERTBOT_EMAIL=you@example.com bash deploy/request-certificate.sh mabeet-lb.com
# One certificate covers the domain and its www, which nginx sends to the domain. nginx must still use its "http"
# file, which answers Let's Encrypt's check. After this, the certbot service renews the certificate by itself.
set -euo pipefail
cd "$(dirname "$0")/.."

domain="${1:?Name the domain, without www: bash deploy/request-certificate.sh mabeet-lb.com}"
email="${CERTBOT_EMAIL:?Set CERTBOT_EMAIL, the address warned before the certificate expires}"

docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --cert-name "$domain" --domain "$domain" --domain "www.$domain" \
  --email "$email" --agree-tos --no-eff-email --non-interactive

echo "Certificate ready for $domain and www.$domain. Now set the DOMAIN variable in GitHub to $domain and deploy again."

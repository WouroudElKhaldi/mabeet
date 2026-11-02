#!/usr/bin/env bash
# Run once on the live server, by hand, when the domain points at it (docs/deployment.md, "Adding the domain"):
#   cd /opt/mabeet && CERTBOT_EMAIL=you@example.com bash deploy/request-certificate.sh mabeet.app
# nginx must still use its "http" file, which answers Let's Encrypt's check. After this, the certbot service renews
# the certificate by itself.
set -euo pipefail
cd "$(dirname "$0")/.."

domain="${1:?Name the domain: bash deploy/request-certificate.sh mabeet.app}"
email="${CERTBOT_EMAIL:?Set CERTBOT_EMAIL, the address warned before the certificate expires}"

docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --domain "$domain" \
  --email "$email" --agree-tos --no-eff-email --non-interactive

echo "Certificate ready for $domain. Now set the DOMAIN variable in GitHub to $domain and run the deploy again."

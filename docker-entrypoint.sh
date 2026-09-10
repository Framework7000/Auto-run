#!/bin/sh
# Cloud secret managers store env vars, not files — this writes the
# Google service-account key from an env var to the path googleSheets.js
# actually expects, so nothing else has to know it arrived differently.
set -e

if [ -n "$GOOGLE_SERVICE_ACCOUNT_JSON_BASE64" ] && [ ! -f /app/data/google-service-account.json ]; then
  echo "$GOOGLE_SERVICE_ACCOUNT_JSON_BASE64" | base64 -d > /app/data/google-service-account.json
  echo "Wrote data/google-service-account.json from GOOGLE_SERVICE_ACCOUNT_JSON_BASE64"
fi

exec "$@"

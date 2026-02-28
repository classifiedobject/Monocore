#!/usr/bin/env sh
set -eu

API_URL="${API_HEALTH_URL:-http://localhost:4000}"
WEB_URL="${WEB_HEALTH_URL:-http://localhost:3000}"

printf 'Checking API /healthz...\n'
curl -fsS "${API_URL}/healthz" >/dev/null
printf 'Checking API /readyz...\n'
curl -fsS "${API_URL}/readyz" >/dev/null
printf 'Checking Web /healthz...\n'
curl -fsS "${WEB_URL}/healthz" >/dev/null

printf 'All health checks passed.\n'

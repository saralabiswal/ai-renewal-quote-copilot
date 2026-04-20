#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "==> Smoke testing ${BASE_URL}"

check() {
  local path="$1"
  curl -fsS "${BASE_URL}${path}" > /dev/null
  echo "PASS ${path}"
}

check "/"
check "/renewal-cases"

# Example renewal cases
check "/renewal-cases/rcase_vertex_industrial"
check "/renewal-cases/rcase_bluepeak"
check "/renewal-cases/rcase_summitone"

# Example quote drafts
check "/quote-drafts/qd_apex_mfg"
check "/quote-drafts/qd_vertex_industrial"

echo "==> Smoke test completed successfully"
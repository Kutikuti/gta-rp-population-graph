#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NPM_AUDIT_CACHE="${NPM_AUDIT_CACHE:-/tmp/npm-cache-gta-rp-structure-audit}"

run_step() {
  local label="$1"
  shift

  echo
  echo "==> ${label}"
  "$@"
}

run_in_project() {
  local project_dir="$1"
  shift

  (
    cd "$ROOT_DIR/$project_dir"
    npm_config_cache="$NPM_AUDIT_CACHE" "$@"
  )
}

run_step "backend: unused exports/dependencies report" \
  run_in_project "backend" npm exec --yes --package knip -- knip --no-exit-code

run_step "web-client: unused exports/dependencies report" \
  run_in_project "web-client" npm exec --yes --package knip -- knip --no-exit-code

run_step "backend: circular dependencies" \
  run_in_project "backend" npm exec --yes --package madge -- madge --extensions ts --ts-config tsconfig.json --circular src

run_step "web-client: circular dependencies" \
  run_in_project "web-client" npm exec --yes --package madge -- madge --extensions ts,tsx --ts-config tsconfig.json --circular src

echo
echo "Audit structurel termine."

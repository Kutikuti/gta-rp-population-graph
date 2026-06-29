#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_step() {
  local label="$1"
  shift

  echo
  echo "==> ${label}"
  "$@"
}

run_npm_script() {
  local project_dir="$1"
  local script_name="$2"

  run_step "${project_dir}: npm run ${script_name}" \
    bash -lc "cd \"$ROOT_DIR/$project_dir\" && npm run $script_name"
}

run_npm_script "backend" "check"
run_npm_script "backend" "test"
run_npm_script "backend" "build"

run_npm_script "web-client" "check"
run_npm_script "web-client" "test"
run_npm_script "web-client" "build"

echo
echo "Tous les checks, tests et builds backend/web-client sont passes."

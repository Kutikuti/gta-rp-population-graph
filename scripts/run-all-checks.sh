#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NODE_VERSION="$(tr -d '[:space:]' < "$ROOT_DIR/.node-version")"
LOCAL_NODE_DIR="$ROOT_DIR/.tools/node-v${NODE_VERSION}"

if [[ -x "$LOCAL_NODE_DIR/bin/node" ]]; then
  export PATH="$LOCAL_NODE_DIR/bin:$PATH"
  export NPM_CONFIG_PREFIX="$LOCAL_NODE_DIR"
fi

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
run_npm_script "backend" "test:coverage"
run_npm_script "backend" "test:integration"
run_npm_script "backend" "build"

run_npm_script "web-client" "check"
run_npm_script "web-client" "test:coverage"
run_npm_script "web-client" "build"

echo
echo "Tous les checks, couvertures de tests et builds backend/web-client sont passes."

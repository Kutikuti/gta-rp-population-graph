#!/usr/bin/env bash
set -euo pipefail

commands=(
  bash
  node
  npm
  npx
  corepack
  git
  ssh
  tar
  gzip
  sha256sum
  mktemp
  find
  grep
  sed
  awk
  curl
  jq
  rg
  fd
  lscpu
  rtk
  serena
  ast-grep
  repomix
)

missing=0

echo "Checking required commands on PATH..."
for command in "${commands[@]}"; do
  if path="$(command -v "$command" 2>/dev/null)"; then
    printf '%-12s %s\n' "$command" "$path"
  else
    printf '%-12s missing\n' "$command" >&2
    missing=1
  fi
done

exit "$missing"

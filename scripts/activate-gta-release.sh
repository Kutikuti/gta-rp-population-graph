#!/usr/bin/env bash
set -euo pipefail
umask 077

# Schema changes must already have been reviewed for compatibility with the
# previous release. This script never reverses or applies database migrations.
APPLICATION_ROOT="${APPLICATION_ROOT:-/var/www/gta-rp-population-graph}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/api/health}"
release="${1:-}"
[[ $# == 1 && "${release}" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || {
  echo "Usage: $0 <release-directory-name>" >&2; exit 2;
}
release_path="${APPLICATION_ROOT}/releases/${release}"
[[ -d "${release_path}" && ! -L "${release_path}" ]] || { echo "Missing release" >&2; exit 1; }
[[ -s "${release_path}/backend/dist/index.js" && -s "${release_path}/web-client/dist/index.html" ]] || {
  echo "Release artifacts are incomplete" >&2; exit 1;
}
[[ -L "${APPLICATION_ROOT}/current" ]] || { echo "Previous release required for rollback" >&2; exit 1; }
exec 9>"${APPLICATION_ROOT}/.activation.lock"
flock -n 9 || { echo "Another activation is running" >&2; exit 1; }
previous="$(readlink -f "${APPLICATION_ROOT}/current")"
[[ -d "${previous}" ]] || { echo "Previous release unavailable" >&2; exit 1; }
temporary_dir="$(mktemp -d "${APPLICATION_ROOT}/.activation.XXXXXX")"
activated=false
committed=false

switch_to() {
  ln -s "$1" "${temporary_dir}/current"
  mv -Tf "${temporary_dir}/current" "${APPLICATION_ROOT}/current"
}

cleanup() {
  local status=$?
  trap - EXIT
  if [[ "${activated}" == true && "${committed}" != true ]]; then
    echo "Activation failed; restoring previous release" >&2
    switch_to "${previous}" || status=1
    sudo -n systemctl restart gta-rp-backend.service || status=1
    status=1
  fi
  rm -rf -- "${temporary_dir}"
  exit "${status}"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

activated=true
switch_to "${release_path}"
sudo -n systemctl restart gta-rp-backend.service
for attempt in {1..10}; do
  if systemctl is-active --quiet gta-rp-backend.service &&
    curl --fail --silent --show-error --connect-timeout 1 --max-time 3 "${HEALTH_URL}" >"${temporary_dir}/health" &&
    grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "${temporary_dir}/health"; then
    committed=true
    echo "Release ${release} active; backend health verified."
    exit 0
  fi
  sleep 1
done
echo "Backend did not become healthy" >&2
exit 1

#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RESOLVED_REPO_ROOT="$(readlink -f "${REPO_ROOT}")"

# `current` is a release symlink in production. Resolve it before finding the
# shared directory, otherwise `current/../shared` incorrectly targets releases/shared.
if [[ "$(basename "$(dirname "${RESOLVED_REPO_ROOT}")")" == "releases" ]]; then
  DEFAULT_SHARED_DIR="$(dirname "$(dirname "${RESOLVED_REPO_ROOT}")")/shared"
else
  DEFAULT_SHARED_DIR="${REPO_ROOT}/../shared"
fi

SHARED_DIR="${SHARED_DIR:-${DEFAULT_SHARED_DIR}}"
UPLOADS_DIR="${UPLOADS_DIR:-${SHARED_DIR}/storage/uploads/characters}"
BACKUP_ROOT="${BACKUP_ROOT:-${SHARED_DIR}/backups/uploads}"
WEEKLY_DIR="${BACKUP_ROOT}/weekly"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

prune_count() {
  local dir="$1"
  local keep="$2"
  local pattern="$3"
  local -a files=()

  mapfile -t files < <(find "${dir}" -maxdepth 1 -type f -name "${pattern}" | sort -r)

  if (( ${#files[@]} <= keep )); then
    return 0
  fi

  for file in "${files[@]:keep}"; do
    rm -f "${file}"
  done
}

[[ "${KEEP_WEEKLY}" =~ ^[1-9][0-9]*$ ]] || { echo "Retention must be positive" >&2; exit 1; }
mkdir -p "${WEEKLY_DIR}"
chmod 700 "${BACKUP_ROOT}" "${WEEKLY_DIR}"
exec 9>"${BACKUP_ROOT}/.backup.lock"
flock -n 9 || { echo "Uploads backup already running" >&2; exit 1; }

if [[ ! -d "${UPLOADS_DIR}" ]]; then
  echo "Uploads directory does not exist: ${UPLOADS_DIR}" >&2
  exit 1
fi

archive_file="${WEEKLY_DIR}/characters_${TIMESTAMP}.tar.gz"
temporary_file="$(mktemp "${WEEKLY_DIR}/.pending.XXXXXX")"
trap 'rm -f -- "${temporary_file}"' EXIT
tar -C "${UPLOADS_DIR}/.." -czf "${temporary_file}" "$(basename "${UPLOADS_DIR}")"
tar -tzf "${temporary_file}" >/dev/null

if [[ ! -s "${temporary_file}" ]]; then
  echo "Uploads archive is empty" >&2
  exit 1
fi
mv -- "${temporary_file}" "${archive_file}"

prune_count "${WEEKLY_DIR}" "${KEEP_WEEKLY}" "*.tar.gz"

echo "Uploads backup complete:"
echo "  file=${archive_file}"
echo "  size=$(du -h "${archive_file}" | awk '{print $1}')"
echo "  weekly_count=$(find "${WEEKLY_DIR}" -maxdepth 1 -type f -name '*.tar.gz' | wc -l | tr -d ' ')"
echo "  disk_free=$(df -h "${BACKUP_ROOT}" | awk 'NR==2 {print $4}')"

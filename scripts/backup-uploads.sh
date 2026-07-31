#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SHARED_DIR="${SHARED_DIR:-${REPO_ROOT}/../shared}"
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

mkdir -p "${WEEKLY_DIR}"

if [[ ! -d "${UPLOADS_DIR}" ]]; then
  echo "Uploads directory does not exist: ${UPLOADS_DIR}" >&2
  exit 1
fi

archive_file="${WEEKLY_DIR}/characters_${TIMESTAMP}.tar.gz"
tar -C "${UPLOADS_DIR}/.." -czf "${archive_file}" "$(basename "${UPLOADS_DIR}")"

if [[ ! -s "${archive_file}" ]]; then
  echo "Uploads archive is empty: ${archive_file}" >&2
  exit 1
fi

prune_count "${WEEKLY_DIR}" "${KEEP_WEEKLY}" "*.tar.gz"

echo "Uploads backup complete:"
echo "  file=${archive_file}"
echo "  size=$(du -h "${archive_file}" | awk '{print $1}')"
echo "  weekly_count=$(find "${WEEKLY_DIR}" -maxdepth 1 -type f -name '*.tar.gz' | wc -l | tr -d ' ')"
echo "  disk_free=$(df -h "${BACKUP_ROOT}" | awk 'NR==2 {print $4}')"

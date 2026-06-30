#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${BACKEND_DIR:-${REPO_ROOT}/backend}"
ENV_FILE="${ENV_FILE:-${BACKEND_DIR}/.env}"
SHARED_DIR="${SHARED_DIR:-${REPO_ROOT}/../shared}"
BACKUP_ROOT="${BACKUP_ROOT:-${SHARED_DIR}/backups/postgres}"
DAILY_DIR="${BACKUP_ROOT}/daily"
WEEKLY_DIR="${BACKUP_ROOT}/weekly"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
PG_DOCKER_CONTAINER="${PG_DOCKER_CONTAINER:-postgres_db}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

require_file() {
  local path="$1"

  if [[ ! -f "${path}" ]]; then
    echo "Missing file: ${path}" >&2
    exit 1
  fi
}

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

require_file "${ENV_FILE}"

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"

mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}"

daily_file="${DAILY_DIR}/${DB_NAME}_${TIMESTAMP}.dump"

if command -v pg_dump >/dev/null 2>&1; then
  export PGPASSWORD="${DB_PASSWORD}"
  pg_dump \
    --dbname="${DB_NAME}" \
    --host="${DB_HOST:-127.0.0.1}" \
    --port="${DB_PORT:-5432}" \
    --username="${DB_USER}" \
    --format=custom \
    --no-owner \
    --no-privileges \
    --file="${daily_file}"
elif command -v sudo >/dev/null 2>&1; then
  sudo docker exec \
    -e "PGPASSWORD=${DB_PASSWORD}" \
    "${PG_DOCKER_CONTAINER}" \
    pg_dump \
    --dbname="${DB_NAME}" \
    --host="127.0.0.1" \
    --port="5432" \
    --username="${DB_USER}" \
    --format=custom \
    --no-owner \
    --no-privileges > "${daily_file}"
else
  echo "Neither pg_dump nor sudo docker are available for PostgreSQL backup." >&2
  exit 1
fi

if [[ ! -s "${daily_file}" ]]; then
  echo "Backup file is empty: ${daily_file}" >&2
  exit 1
fi

if [[ "$(date -u +%u)" == "7" ]]; then
  cp "${daily_file}" "${WEEKLY_DIR}/"
fi

prune_count "${DAILY_DIR}" "${KEEP_DAILY}" "*.dump"
prune_count "${WEEKLY_DIR}" "${KEEP_WEEKLY}" "*.dump"

echo "PostgreSQL backup complete:"
echo "  file=${daily_file}"
echo "  size=$(du -h "${daily_file}" | awk '{print $1}')"
echo "  daily_count=$(find "${DAILY_DIR}" -maxdepth 1 -type f -name '*.dump' | wc -l | tr -d ' ')"
echo "  weekly_count=$(find "${WEEKLY_DIR}" -maxdepth 1 -type f -name '*.dump' | wc -l | tr -d ' ')"
echo "  disk_free=$(df -h "${BACKUP_ROOT}" | awk 'NR==2 {print $4}')"

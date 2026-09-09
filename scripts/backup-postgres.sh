#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${BACKEND_DIR:-${REPO_ROOT}/backend}"
ENV_FILE="${ENV_FILE:-${BACKEND_DIR}/.env}"
RESOLVED_REPO_ROOT="$(readlink -f "${REPO_ROOT}")"
if [[ "$(basename "$(dirname "${RESOLVED_REPO_ROOT}")")" == "releases" ]]; then
  DEFAULT_SHARED_DIR="$(dirname "$(dirname "${RESOLVED_REPO_ROOT}")")/shared"
else
  DEFAULT_SHARED_DIR="${REPO_ROOT}/../shared"
fi
SHARED_DIR="${SHARED_DIR:-${DEFAULT_SHARED_DIR}}"
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

[[ "${DB_NAME}" =~ ^[a-zA-Z0-9_]+$ ]] || { echo "Invalid DB_NAME" >&2; exit 1; }
[[ "${KEEP_DAILY}" =~ ^[1-9][0-9]*$ && "${KEEP_WEEKLY}" =~ ^[1-9][0-9]*$ ]] || { echo "Retention must be positive" >&2; exit 1; }

mkdir -p "${DAILY_DIR}" "${WEEKLY_DIR}"
chmod 700 "${BACKUP_ROOT}" "${DAILY_DIR}" "${WEEKLY_DIR}"
exec 9>"${BACKUP_ROOT}/.backup.lock"
flock -n 9 || { echo "PostgreSQL backup already running" >&2; exit 1; }

daily_file="${DAILY_DIR}/${DB_NAME}_${TIMESTAMP}.dump"
temporary_file="$(mktemp "${DAILY_DIR}/.pending.XXXXXX")"
weekly_temporary=""
trap 'rm -f -- "${temporary_file}" "${weekly_temporary}"' EXIT
export PGPASSWORD="${DB_PASSWORD}"

if command -v pg_dump >/dev/null 2>&1; then
  pg_dump \
    --dbname="${DB_NAME}" \
    --host="${DB_HOST:-127.0.0.1}" \
    --port="${DB_PORT:-5432}" \
    --username="${DB_USER}" \
    --format=custom \
    --no-owner \
    --no-privileges \
    --file="${temporary_file}"
  pg_restore --list "${temporary_file}" >/dev/null
elif command -v sudo >/dev/null 2>&1; then
  sudo --preserve-env=PGPASSWORD docker exec \
    -e PGPASSWORD \
    "${PG_DOCKER_CONTAINER}" \
    pg_dump \
    --dbname="${DB_NAME}" \
    --host="127.0.0.1" \
    --port="5432" \
    --username="${DB_USER}" \
    --format=custom \
    --no-owner \
    --no-privileges >"${temporary_file}"
  sudo docker exec -i "${PG_DOCKER_CONTAINER}" pg_restore --list <"${temporary_file}" >/dev/null
else
  echo "Neither pg_dump nor sudo docker are available for PostgreSQL backup." >&2
  exit 1
fi

if [[ ! -s "${temporary_file}" ]]; then
  echo "Backup file is empty" >&2
  exit 1
fi
mv -- "${temporary_file}" "${daily_file}"

if [[ "$(date -u +%u)" == "7" ]]; then
  weekly_temporary="$(mktemp "${WEEKLY_DIR}/.pending.XXXXXX")"
  cp "${daily_file}" "${weekly_temporary}"
  mv -- "${weekly_temporary}" "${WEEKLY_DIR}/$(basename "${daily_file}")"
fi

prune_count "${DAILY_DIR}" "${KEEP_DAILY}" "*.dump"
prune_count "${WEEKLY_DIR}" "${KEEP_WEEKLY}" "*.dump"

echo "PostgreSQL backup complete:"
echo "  file=${daily_file}"
echo "  size=$(du -h "${daily_file}" | awk '{print $1}')"
echo "  daily_count=$(find "${DAILY_DIR}" -maxdepth 1 -type f -name '*.dump' | wc -l | tr -d ' ')"
echo "  weekly_count=$(find "${WEEKLY_DIR}" -maxdepth 1 -type f -name '*.dump' | wc -l | tr -d ' ')"
echo "  disk_free=$(df -h "${BACKUP_ROOT}" | awk 'NR==2 {print $4}')"

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SSH_HOST="${SSH_HOST:-65.109.171.143}"
SSH_PORT="${SSH_PORT:-22}"
SSH_USER="${SSH_USER:-codex-deploy}"
SSH_KEY="${SSH_KEY:-${REPO_ROOT}/.secrets/codex_gta_rp_deploy}"
REMOTE_BACKUP_ROOT="${REMOTE_BACKUP_ROOT:-/var/www/gta-rp-population-graph/shared/backups}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-${REPO_ROOT}/.backups/server}"
FETCH_POSTGRES=false
FETCH_UPLOADS=false

usage() {
  cat <<'USAGE'
Fetch the latest production backup archives from the VPS.

Usage:
  scripts/fetch-latest-backups.sh [--all] [--postgres] [--uploads]

Options:
  --all        Fetch latest PostgreSQL and uploads backups. Default.
  --postgres   Fetch only the latest PostgreSQL backup.
  --uploads    Fetch only the latest uploads backup.
  -h, --help   Show this help.

Environment overrides:
  SSH_HOST              default: 65.109.171.143
  SSH_PORT              default: 22
  SSH_USER              default: codex-deploy
  SSH_KEY               default: .secrets/codex_gta_rp_deploy
  REMOTE_BACKUP_ROOT    default: /var/www/gta-rp-population-graph/shared/backups
  LOCAL_BACKUP_DIR      default: .backups/server

Examples:
  scripts/fetch-latest-backups.sh
  scripts/fetch-latest-backups.sh --postgres
  LOCAL_BACKUP_DIR=~/gta-rp-backups scripts/fetch-latest-backups.sh --all
USAGE
}

while (($#)); do
  case "$1" in
    --all)
      FETCH_POSTGRES=true
      FETCH_UPLOADS=true
      ;;
    --postgres)
      FETCH_POSTGRES=true
      ;;
    --uploads)
      FETCH_UPLOADS=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ "${FETCH_POSTGRES}" == false && "${FETCH_UPLOADS}" == false ]]; then
  FETCH_POSTGRES=true
  FETCH_UPLOADS=true
fi

if [[ ! -f "${SSH_KEY}" ]]; then
  echo "SSH key not found: ${SSH_KEY}" >&2
  exit 1
fi

ssh_args=(
  -i "${SSH_KEY}"
  -p "${SSH_PORT}"
  -o StrictHostKeyChecking=accept-new
)

scp_args=(
  -i "${SSH_KEY}"
  -P "${SSH_PORT}"
  -o StrictHostKeyChecking=accept-new
  -p
)

remote_latest() {
  local remote_dir="$1"
  local pattern="$2"
  local quoted_dir
  local quoted_pattern

  printf -v quoted_dir "%q" "${remote_dir}"
  printf -v quoted_pattern "%q" "${pattern}"

  ssh "${ssh_args[@]}" "${SSH_USER}@${SSH_HOST}" \
    "find ${quoted_dir} -maxdepth 1 -type f -name ${quoted_pattern} -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d ' ' -f 2-"
}

fetch_latest() {
  local label="$1"
  local remote_dir="$2"
  local pattern="$3"
  local local_dir="$4"
  local remote_file
  local local_file

  remote_file="$(remote_latest "${remote_dir}" "${pattern}")"

  if [[ -z "${remote_file}" ]]; then
    echo "No ${label} backup found in ${remote_dir}." >&2
    return 1
  fi

  mkdir -p "${local_dir}"
  local_file="${local_dir}/$(basename "${remote_file}")"

  scp "${scp_args[@]}" "${SSH_USER}@${SSH_HOST}:${remote_file}" "${local_file}"

  if [[ ! -s "${local_file}" ]]; then
    echo "Downloaded ${label} backup is empty: ${local_file}" >&2
    exit 1
  fi

  echo "${label} backup fetched:"
  echo "  remote=${remote_file}"
  echo "  local=${local_file}"
  echo "  size=$(du -h "${local_file}" | awk '{print $1}')"
}

if [[ "${FETCH_POSTGRES}" == true ]]; then
  fetch_latest \
    "PostgreSQL" \
    "${REMOTE_BACKUP_ROOT}/postgres/daily" \
    "*.dump" \
    "${LOCAL_BACKUP_DIR}/postgres"
fi

if [[ "${FETCH_UPLOADS}" == true ]]; then
  fetch_latest \
    "Uploads" \
    "${REMOTE_BACKUP_ROOT}/uploads/weekly" \
    "*.tar.gz" \
    "${LOCAL_BACKUP_DIR}/uploads"
fi

#!/usr/bin/env bash
set -uo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BASE_URL="${BASE_URL:-https://gta-rp.f1prediction.fr}"
SSH_HOST="${SSH_HOST:-65.109.171.143}"
SSH_PORT="${SSH_PORT:-22}"
SSH_USER="${SSH_USER:-codex-deploy}"
SSH_KEY="${SSH_KEY:-${REPO_ROOT}/.secrets/codex_gta_rp_deploy}"
REMOTE_BACKUP_ROOT="${REMOTE_BACKUP_ROOT:-/var/www/gta-rp-population-graph/shared/backups}"
MONITORING_SHARED_DIR="${MONITORING_SHARED_DIR:-/var/www/platform-ops/monitoring/data}"
PUBLIC_ONLY=false
SSH_ONLY=false
FAILED=0
CHECK_TMP="$(mktemp -d)"
trap 'rm -rf -- "${CHECK_TMP}"' EXIT

ssh_args=(
  -i "${SSH_KEY}"
  -p "${SSH_PORT}"
  -o StrictHostKeyChecking=yes
  -o BatchMode=yes
  -o ConnectTimeout=10
)

usage() {
  cat <<'USAGE'
Run read-only production ops checks.

Usage:
  scripts/check-production-ops.sh [--all] [--public-only] [--ssh-only]

Options:
  --all          Run public HTTP checks and SSH server checks. Default.
  --public-only  Run only public HTTP checks.
  --ssh-only     Run only SSH server checks.
  -h, --help     Show this help.

Environment overrides:
  BASE_URL              default: https://gta-rp.f1prediction.fr
  SSH_HOST              default: 65.109.171.143
  SSH_PORT              default: 22
  SSH_USER              default: codex-deploy
  SSH_KEY               default: .secrets/codex_gta_rp_deploy
  REMOTE_BACKUP_ROOT    default: /var/www/gta-rp-population-graph/shared/backups
  MONITORING_SHARED_DIR default: /var/www/platform-ops/monitoring/data
USAGE
}

mark_ok() {
  echo "OK   $1"
}

mark_fail() {
  echo "FAIL $1" >&2
  FAILED=1
}

run_check() {
  local label="$1"
  shift

  if "$@" >"${CHECK_TMP}/stdout" 2>"${CHECK_TMP}/stderr"; then
    mark_ok "${label}"
  else
    mark_fail "${label}"
    sed 's/^/     /' "${CHECK_TMP}/stderr" >&2
  fi
}

while (($#)); do
  case "$1" in
    --all)
      PUBLIC_ONLY=false
      SSH_ONLY=false
      ;;
    --public-only)
      PUBLIC_ONLY=true
      ;;
    --ssh-only)
      SSH_ONLY=true
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

if [[ "${PUBLIC_ONLY}" == true && "${SSH_ONLY}" == true ]]; then
  echo "--public-only and --ssh-only cannot be combined." >&2
  exit 1
fi

http_check() {
  local path="$1" expected="$2" pattern="${3:-}" status
  status="$(curl --silent --show-error --connect-timeout 10 --max-time 30 \
    --output "${CHECK_TMP}/body" --write-out '%{http_code}' "${BASE_URL}${path}")" || return 1
  [[ " ${expected} " == *" ${status} "* ]] || { echo "Unexpected HTTP ${status} for ${path}" >&2; return 1; }
  [[ -z "${pattern}" ]] || grep -Eq "${pattern}" "${CHECK_TMP}/body"
}

check_public() {
  echo "== Public HTTP checks =="
  run_check "public page returns HTTP 200" \
    http_check / 200
  run_check "health endpoint returns ok" \
    http_check /api/health 200 '"status"[[:space:]]*:[[:space:]]*"ok"'
  run_check "anonymous session is readable" \
    http_check /api/auth/session 200 '"authenticated"[[:space:]]*:[[:space:]]*false'
  run_check "public characters endpoint returns items" \
    http_check '/api/characters?limit=1' 200 '"items"[[:space:]]*:'
  run_check "Google OAuth starts with redirect" \
    http_check /api/auth/google 302
  run_check "supervision is not public without admin session" \
    http_check /supervision/ '302 401 403'
  run_check "administration is not public" http_check /api/admin/dashboard 401
}

check_ssh() {
  echo "== SSH server checks =="

  for remote_path in "${REMOTE_BACKUP_ROOT}" "${MONITORING_SHARED_DIR}"; do
    [[ "${remote_path}" =~ ^/[a-zA-Z0-9_./-]+$ ]] || { mark_fail "invalid remote path"; return; }
  done

  if [[ ! -f "${SSH_KEY}" ]]; then
    mark_fail "SSH key exists at ${SSH_KEY}"
    return
  fi

  run_check "backend, Caddy and timers are active" \
    ssh "${ssh_args[@]}" "${SSH_USER}@${SSH_HOST}" \
    "for unit in gta-rp-backend.service caddy gta-rp-photo-cleanup.timer gta-rp-postgres-backup.timer gta-rp-uploads-backup.timer platform-ops-textfile.timer; do systemctl is-active --quiet \"\$unit\" || exit 1; done"

  run_check "PostgreSQL backup is less than 36 hours old in the restore directory" \
    ssh "${ssh_args[@]}" "${SSH_USER}@${SSH_HOST}" \
    "find '${REMOTE_BACKUP_ROOT}/postgres/daily' -maxdepth 1 -type f -name '*.dump' -size +0c -mmin -2160 | grep -q ."

  run_check "uploads backup is less than 8 days old" \
    ssh "${ssh_args[@]}" "${SSH_USER}@${SSH_HOST}" \
    "find '${REMOTE_BACKUP_ROOT}/uploads/weekly' -maxdepth 1 -type f -name '*.tar.gz' -size +0c -mmin -11520 | grep -q ."

  run_check "backup directories are private" \
    ssh "${ssh_args[@]}" "${SSH_USER}@${SSH_HOST}" \
    "test \"\$(stat -c %a '${REMOTE_BACKUP_ROOT}/postgres/daily')\" = 700 && test \"\$(stat -c %a '${REMOTE_BACKUP_ROOT}/uploads/weekly')\" = 700"

  run_check "firewall is active and PostgreSQL is not public" \
    ssh "${ssh_args[@]}" "${SSH_USER}@${SSH_HOST}" \
    "sudo -n ufw status verbose | grep -q 'Status: active' && sudo -n ufw status verbose | grep -q '5432/tcp.*DENY IN'"

  run_check "fail2ban sshd jail is available" \
    ssh "${ssh_args[@]}" "${SSH_USER}@${SSH_HOST}" \
    "sudo -n fail2ban-client status sshd >/dev/null"

  run_check "root filesystem below 80 percent" \
    ssh "${ssh_args[@]}" "${SSH_USER}@${SSH_HOST}" \
    "test \"\$(df -P / | awk 'NR==2 {gsub(/%/, \"\", \$5); print \$5}')\" -lt 80"

  run_check "journald retention is configured" \
    ssh "${ssh_args[@]}" "${SSH_USER}@${SSH_HOST}" \
    "systemd-analyze cat-config systemd/journald.conf | grep -q '^SystemMaxUse=500M' && systemd-analyze cat-config systemd/journald.conf | grep -q '^MaxRetentionSec=30day'"

  run_check "monitoring stack is healthy locally" \
    ssh "${ssh_args[@]}" "${SSH_USER}@${SSH_HOST}" \
    "sudo -n docker ps --format '{{.Names}}' | grep -E 'monitoring[-_](prometheus|grafana|blackbox-exporter|node-exporter)[-_]1' | wc -l | grep -q '^4$' && curl -fsS --connect-timeout 5 --max-time 10 http://127.0.0.1:9090/-/healthy >/dev/null"

  run_check "monitoring ports are bound locally only" \
    ssh "${ssh_args[@]}" "${SSH_USER}@${SSH_HOST}" \
    "ss -lnt | grep -q '127.0.0.1:3001' && ss -lnt | grep -q '127.0.0.1:9090' && ss -lnt | grep -q '127.0.0.1:9100' && ss -lnt | grep -q '127.0.0.1:9115'"

  run_check "monitoring textfile metrics exist" \
    ssh "${ssh_args[@]}" "${SSH_USER}@${SSH_HOST}" \
    "test -s '${MONITORING_SHARED_DIR}/node-exporter-textfile/gta_rp_ops.prom'"

  run_check "backend port is bound to IPv4 loopback" \
    ssh "${ssh_args[@]}" "${SSH_USER}@${SSH_HOST}" \
    "ss -H -lnt 'sport = :4000' | awk '{print \$4}' | grep -x '127.0.0.1:4000' >/dev/null && ! ss -H -lnt 'sport = :4000' | awk '{print \$4}' | grep -vx '127.0.0.1:4000'"
}

if [[ "${SSH_ONLY}" != true ]]; then
  check_public
fi

if [[ "${PUBLIC_ONLY}" != true ]]; then
  check_ssh
fi

if [[ "${FAILED}" -eq 0 ]]; then
  echo "All selected production ops checks passed."
fi

exit "${FAILED}"

#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BASE_URL="${BASE_URL:-https://gta-rp.f1prediction.fr}"
SSH_HOST="${SSH_HOST:-65.109.171.143}"
SSH_PORT="${SSH_PORT:-22}"
SSH_USER="${SSH_USER:-codex-deploy}"
SSH_KEY="${SSH_KEY:-${REPO_ROOT}/.secrets/codex_gta_rp_deploy}"
REMOTE_BACKUP_ROOT="${REMOTE_BACKUP_ROOT:-/var/www/gta-rp-population-graph/shared/backups}"
MONITORING_SHARED_DIR="${MONITORING_SHARED_DIR:-/var/www/gta-rp-population-graph/shared/monitoring}"
PUBLIC_ONLY=false
SSH_ONLY=false
FAILED=0

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
  MONITORING_SHARED_DIR default: /var/www/gta-rp-population-graph/shared/monitoring
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

  if "$@" >/tmp/gta-rp-ops-check.out 2>/tmp/gta-rp-ops-check.err; then
    mark_ok "${label}"
  else
    mark_fail "${label}"
    sed 's/^/     /' /tmp/gta-rp-ops-check.err >&2
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

check_public() {
  echo "== Public HTTP checks =="
  run_check "public page returns HTTP 200" \
    curl -fsSI "${BASE_URL}/"
  run_check "health endpoint returns ok" \
    bash -c "curl -fsS '${BASE_URL}/api/health' | grep -q '\"status\":\"ok\"'"
  run_check "anonymous session is readable" \
    bash -c "curl -fsS '${BASE_URL}/api/auth/session' | grep -q '\"authenticated\":false'"
  run_check "public characters endpoint returns items" \
    bash -c "curl -fsS '${BASE_URL}/api/characters?limit=1' | grep -q '\"items\"'"
  run_check "Google OAuth starts with redirect" \
    bash -c "curl -fsSI '${BASE_URL}/api/auth/google' | grep -q '^HTTP/2 302\\|^HTTP/1.1 302'"
  run_check "supervision is not public without admin session" \
    bash -c "curl -fsSI '${BASE_URL}/supervision/' | grep -q '^HTTP/2 302\\|^HTTP/1.1 302\\|^HTTP/2 401\\|^HTTP/1.1 401\\|^HTTP/2 403\\|^HTTP/1.1 403'"
}

ssh_cmd() {
  ssh \
    -i "${SSH_KEY}" \
    -p "${SSH_PORT}" \
    -o StrictHostKeyChecking=accept-new \
    "${SSH_USER}@${SSH_HOST}" \
    "$1"
}

check_ssh() {
  echo "== SSH server checks =="

  if [[ ! -f "${SSH_KEY}" ]]; then
    mark_fail "SSH key exists at ${SSH_KEY}"
    return
  fi

  run_check "backend, Caddy and timers are active" \
    ssh_cmd "systemctl is-active gta-rp-backend.service caddy gta-rp-photo-cleanup.timer gta-rp-postgres-backup.timer gta-rp-uploads-backup.timer gta-rp-monitoring-textfile.timer >/dev/null"

  run_check "latest PostgreSQL backup exists" \
    ssh_cmd "find '${REMOTE_BACKUP_ROOT}/postgres/daily' -maxdepth 1 -type f -name '*.dump' -size +0c | grep -q ."

  run_check "latest uploads backup exists" \
    ssh_cmd "find '${REMOTE_BACKUP_ROOT}/uploads/weekly' -maxdepth 1 -type f -name '*.tar.gz' -size +0c | grep -q ."

  run_check "firewall is active and PostgreSQL is not public" \
    ssh_cmd "sudo ufw status verbose | grep -q 'Status: active' && sudo ufw status verbose | grep -q '5432/tcp.*DENY IN'"

  run_check "fail2ban sshd jail is available" \
    ssh_cmd "sudo fail2ban-client status sshd >/dev/null"

  run_check "root filesystem below 80 percent" \
    ssh_cmd "test \"\$(df -P / | awk 'NR==2 {gsub(/%/, \"\", \$5); print \$5}')\" -lt 80"

  run_check "journald retention is configured" \
    ssh_cmd "systemd-analyze cat-config systemd/journald.conf | grep -q '^SystemMaxUse=500M' && systemd-analyze cat-config systemd/journald.conf | grep -q '^MaxRetentionSec=30day'"

  run_check "monitoring stack is healthy locally" \
    ssh_cmd "sudo docker ps --format '{{.Names}}' | grep -E 'monitoring[-_](prometheus|grafana|blackbox-exporter|node-exporter)[-_]1' | wc -l | grep -q '^4$' && curl -fsS http://127.0.0.1:9090/-/healthy >/dev/null"

  run_check "monitoring ports are bound locally only" \
    ssh_cmd "ss -lnt | grep -q '127.0.0.1:3001' && ss -lnt | grep -q '127.0.0.1:9090' && ss -lnt | grep -q '127.0.0.1:9100' && ss -lnt | grep -q '127.0.0.1:9115'"

  run_check "monitoring textfile metrics exist" \
    ssh_cmd "test -s '${MONITORING_SHARED_DIR}/node-exporter-textfile/gta_rp_ops.prom'"
}

if [[ "${SSH_ONLY}" != true ]]; then
  check_public
fi

if [[ "${PUBLIC_ONLY}" != true ]]; then
  check_ssh
fi

rm -f /tmp/gta-rp-ops-check.out /tmp/gta-rp-ops-check.err

if [[ "${FAILED}" -eq 0 ]]; then
  echo "All selected production ops checks passed."
fi

exit "${FAILED}"

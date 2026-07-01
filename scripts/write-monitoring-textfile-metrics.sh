#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SHARED_DIR="${SHARED_DIR:-${REPO_ROOT}/../shared}"
BACKUP_ROOT="${BACKUP_ROOT:-${SHARED_DIR}/backups}"
UPLOADS_DIR="${UPLOADS_DIR:-${SHARED_DIR}/storage/uploads/characters}"
TEXTFILE_DIR="${TEXTFILE_DIR:-${SHARED_DIR}/monitoring/node-exporter-textfile}"
OUTPUT_FILE="${TEXTFILE_DIR}/gta_rp_ops.prom"
TMP_FILE="${OUTPUT_FILE}.$$"

latest_file_metric() {
  local metric_prefix="$1"
  local dir="$2"
  local pattern="$3"
  local latest_file=""
  local latest_timestamp="0"
  local latest_size="0"

  if [[ -d "${dir}" ]]; then
    latest_file="$(find "${dir}" -maxdepth 1 -type f -name "${pattern}" -printf '%T@ %s %p\n' | sort -nr | head -n 1 || true)"
  fi

  if [[ -n "${latest_file}" ]]; then
    latest_timestamp="$(awk '{printf "%d", $1}' <<<"${latest_file}")"
    latest_size="$(awk '{print $2}' <<<"${latest_file}")"
  fi

  {
    echo "# HELP ${metric_prefix}_latest_timestamp_seconds Timestamp Unix de la derniere sauvegarde."
    echo "# TYPE ${metric_prefix}_latest_timestamp_seconds gauge"
    echo "${metric_prefix}_latest_timestamp_seconds ${latest_timestamp}"
    echo "# HELP ${metric_prefix}_latest_size_bytes Taille de la derniere sauvegarde."
    echo "# TYPE ${metric_prefix}_latest_size_bytes gauge"
    echo "${metric_prefix}_latest_size_bytes ${latest_size}"
  } >>"${TMP_FILE}"
}

mkdir -p "${TEXTFILE_DIR}"
: >"${TMP_FILE}"

latest_file_metric "gta_rp_backup_postgres" "${BACKUP_ROOT}/postgres/daily" "*.dump"
latest_file_metric "gta_rp_backup_uploads" "${BACKUP_ROOT}/uploads/weekly" "*.tar.gz"

uploads_size="0"
uploads_count="0"

if [[ -d "${UPLOADS_DIR}" ]]; then
  uploads_size="$(find "${UPLOADS_DIR}" -maxdepth 1 -type f -name '*.webp' -printf '%s\n' | awk '{sum += $1} END {printf "%d", sum}')"
  uploads_count="$(find "${UPLOADS_DIR}" -maxdepth 1 -type f -name '*.webp' | wc -l | tr -d ' ')"
fi

{
  echo "# HELP gta_rp_uploads_validated_size_bytes Taille totale des photos validees."
  echo "# TYPE gta_rp_uploads_validated_size_bytes gauge"
  echo "gta_rp_uploads_validated_size_bytes ${uploads_size}"
  echo "# HELP gta_rp_uploads_validated_files Nombre de photos validees."
  echo "# TYPE gta_rp_uploads_validated_files gauge"
  echo "gta_rp_uploads_validated_files ${uploads_count}"
} >>"${TMP_FILE}"

mv "${TMP_FILE}" "${OUTPUT_FILE}"

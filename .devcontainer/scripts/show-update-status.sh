#!/usr/bin/env bash
set -euo pipefail

SUMMARY_FILE=".devcontainer/.cache/update-check/summary.txt"
DETAILS_FILE=".devcontainer/.cache/update-check/details.txt"

USE_COLOR=0
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  USE_COLOR=1
fi

color() {
  local code="$1"
  local text="$2"

  if [ "$USE_COLOR" -eq 1 ]; then
    printf '\033[%sm%s\033[0m' "$code" "$text"
  else
    printf '%s' "$text"
  fi
}

print_warning_line() {
  local line="$1"

  if [[ "$line" =~ ^-\ (.+)\ has\ a\ newer\ version:\ pinned\ ([^,]+),\ latest\ (.+)$ ]]; then
    color '1;33' "- ${BASH_REMATCH[1]} has a newer version:"
    printf ' pinned '
    color '31' "${BASH_REMATCH[2]}"
    printf ', latest '
    color '32' "${BASH_REMATCH[3]}"
    printf '\n'

    return
  fi

  color '1;33' "$line"
  printf '\n'
}

print_summary() {
  local line=""

  while IFS= read -r line; do
    case "$line" in
      'Mewtwo devcontainer update status')
        color '1' "$line"
        printf '\n'
        ;;
      Checked:*)
        color '2' "$line"
        printf '\n'
        ;;
      'Warnings:')
        color '1;33' "$line"
        printf '\n'
        ;;
      '- '*)
        print_warning_line "$line"
        ;;
      'No update warnings.')
        color '32' "$line"
        printf '\n'
        ;;
      *)
        printf '%s\n' "$line"
        ;;
    esac
  done < "$SUMMARY_FILE"
}

if [ ! -r "$SUMMARY_FILE" ]; then
  echo "No devcontainer update status has been recorded yet."

  exit 0
fi

if grep -q '^Warnings:' "$SUMMARY_FILE"; then
  color '1;33' "== Mewtwo devcontainer update warnings =="
  printf '\n'
  print_summary
  printf 'Details: '
  color '36' "$DETAILS_FILE"
  printf '\n'

  exit 0
fi

color '1;32' "== Mewtwo devcontainer update status =="
printf '\n'
print_summary

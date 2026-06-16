#!/usr/bin/env bash
set -uo pipefail

CACHE_DIR=".devcontainer/.cache/update-check"
SUMMARY_FILE="$CACHE_DIR/summary.txt"
DETAILS_FILE="$CACHE_DIR/details.txt"
STAMP_FILE="$CACHE_DIR/last-check"
TTL_SECONDS="${DEVCONTAINER_UPDATE_CHECK_TTL_SECONDS:-86400}"

announce() {
  printf 'devcontainer update check: %s\n' "$1"
}

mkdir -p "$CACHE_DIR"

now="$(date +%s)"
last_check=""
if [ -r "$STAMP_FILE" ]; then
  last_check="$(cat "$STAMP_FILE")"
fi

if [[ "$last_check" =~ ^[0-9]+$ ]] && [ "$TTL_SECONDS" -gt 0 ] && [ $((now - last_check)) -lt "$TTL_SECONDS" ]; then
  announce "cache is fresh; skipping network checks"
  exit 0
fi

announce "loading pinned tool versions"
VERSIONS_FILE="/usr/local/share/devcontainer/versions.env"
if [ ! -f "$VERSIONS_FILE" ]; then
  VERSIONS_FILE=".devcontainer/versions.env"
fi

# shellcheck disable=SC1090
. "$VERSIONS_FILE"

NODE_VERSION_FILE="/usr/local/share/devcontainer/node-version"
if [ ! -f "$NODE_VERSION_FILE" ]; then
  NODE_VERSION_FILE=".node-version"
fi

NODE_VERSION="$(tr -d '[:space:]' < "$NODE_VERSION_FILE")"
CHECKED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
WARNINGS=()
DETAILS=()

add_warning() {
  WARNINGS+=("$1")
  DETAILS+=("WARN: $1")
}

add_detail() {
  DETAILS+=("$1")
}

version_gt() {
  dpkg --compare-versions "${1#v}" gt "${2#v}"
}

warn_if_newer() {
  local label="$1"
  local current="$2"
  local latest="$3"

  if [ -z "$latest" ]; then
    add_detail "$label: latest version unavailable"

    return
  fi

  if version_gt "$latest" "$current"; then
    add_warning "$label has a newer version: pinned $current, latest $latest"
  else
    add_detail "$label: pinned $current, latest $latest"
  fi
}

fetch_json_value() {
  local url="$1"
  local jq_filter="$2"

  curl -fsSL --max-time 30 "$url" | jq -r "$jq_filter"
}

check_debian_base() {
  announce "checking Debian base image digest"

  local image_name="debian:13.5-slim"
  local recorded_digest=""
  local token=""
  local current_digest=""

  if [ -r /usr/local/share/devcontainer/base-image.name ]; then
    image_name="$(cat /usr/local/share/devcontainer/base-image.name)"
  fi

  if [ -r /usr/local/share/devcontainer/base-image.digest ]; then
    recorded_digest="$(cat /usr/local/share/devcontainer/base-image.digest)"
  fi

  if [ -z "$recorded_digest" ]; then
    add_detail "Debian base image: recorded digest unavailable"

    return
  fi

  token="$(fetch_json_value "https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/debian:pull" '.token // empty' 2>/dev/null || true)"
  if [ -z "$token" ]; then
    add_detail "Debian base image: Docker registry token unavailable"

    return
  fi

  current_digest="$(curl -fsSI --max-time 30 \
    -H "Authorization: Bearer $token" \
    -H "Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json" \
    "https://registry-1.docker.io/v2/library/debian/manifests/13.5-slim" \
    | awk -F': ' 'tolower($1)=="docker-content-digest" { gsub("\r", "", $2); print $2; exit }' || true)"

  if [ -z "$current_digest" ]; then
    add_detail "Debian base image: current registry digest unavailable"

    return
  fi

  if [ "$recorded_digest" != "$current_digest" ]; then
    add_warning "$image_name digest changed; rebuild the devcontainer when convenient"
  else
    add_detail "$image_name digest unchanged: $recorded_digest"
  fi
}

check_apt_upgrades() {
  announce "checking apt package metadata"

  local upgradable=""
  local count=0

  if ! sudo apt-get update -qq >/tmp/mewtwo-devcontainer-apt-update.log 2>&1; then
    add_detail "apt: metadata refresh failed; see /tmp/mewtwo-devcontainer-apt-update.log"

    return
  fi

  upgradable="$(apt list --upgradable 2>/dev/null | sed '1d' || true)"
  count="$(printf '%s\n' "$upgradable" | sed '/^$/d' | wc -l | tr -d '[:space:]')"

  if [ "$count" -gt 0 ]; then
    add_warning "apt has $count upgradable package(s); rebuild the devcontainer instead of running apt upgrade"
    add_detail "apt upgradable packages:"
    while IFS= read -r line; do
      [ -n "$line" ] && add_detail "  $line"
    done <<< "$upgradable"
  else
    add_detail "apt: no upgradable packages"
  fi
}

check_node() {
  announce "checking Node.js releases"

  local latest=""

  latest="$(curl -fsSL --max-time 30 https://nodejs.org/dist/index.json \
    | jq -r '[.[] | select(.version | startswith("v24.")) | select(.lts != false)] | .[0].version // empty' 2>/dev/null || true)"

  if [ -z "$latest" ]; then
    latest="$(curl -fsSL --max-time 30 https://nodejs.org/dist/index.json \
      | jq -r '[.[] | select(.version | startswith("v24."))] | .[0].version // empty' 2>/dev/null || true)"
  fi

  warn_if_newer "Node 24" "v$NODE_VERSION" "$latest"
}

check_npm_package() {
  local label="$1"
  local package_url="$2"
  local current="$3"
  local latest=""

  announce "checking $label package release"
  latest="$(fetch_json_value "$package_url" '.version // empty' 2>/dev/null || true)"
  warn_if_newer "$label" "$current" "$latest"
}

check_github_release() {
  local label="$1"
  local repository="$2"
  local current="$3"
  local latest=""

  announce "checking $label GitHub release"
  latest="$(fetch_json_value "https://api.github.com/repos/$repository/releases/latest" '.tag_name // empty' 2>/dev/null || true)"
  warn_if_newer "$label" "$current" "$latest"
}

check_debian_base
check_apt_upgrades
check_node
check_npm_package "npm" "https://registry.npmjs.org/npm/latest" "$NPM_VERSION"
check_github_release "uv" "astral-sh/uv" "$UV_VERSION"
announce "checking Serena PyPI release"
warn_if_newer "Serena" "$SERENA_VERSION" "$(fetch_json_value "https://pypi.org/pypi/serena-agent/json" '.info.version // empty' 2>/dev/null || true)"
check_github_release "RTK" "rtk-ai/rtk" "$RTK_VERSION"
check_npm_package "ast-grep" "https://registry.npmjs.org/%40ast-grep%2Fcli/latest" "$AST_GREP_CLI_VERSION"
check_npm_package "Repomix" "https://registry.npmjs.org/repomix/latest" "$REPOMIX_VERSION"

announce "writing update summary"
{
  echo "Mewtwo devcontainer update status"
  echo "Checked: $CHECKED_AT"
  echo

  if [ "${#WARNINGS[@]}" -eq 0 ]; then
    echo "No update warnings."
  else
    echo "Warnings:"
    for warning in "${WARNINGS[@]}"; do
      echo "- $warning"
    done
  fi
} > "$SUMMARY_FILE.tmp"
mv "$SUMMARY_FILE.tmp" "$SUMMARY_FILE"

{
  echo "Mewtwo devcontainer update check details"
  echo "Checked: $CHECKED_AT"
  echo
  for detail in "${DETAILS[@]}"; do
    echo "$detail"
  done
} > "$DETAILS_FILE.tmp"
mv "$DETAILS_FILE.tmp" "$DETAILS_FILE"

printf '%s\n' "$now" > "$STAMP_FILE"
announce "done"

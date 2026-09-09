#!/usr/bin/env bash
set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
output="${1:-}"
[[ $# == 1 && "${output}" == /* && ! -e "${output}" ]] || {
  echo "Usage: $0 /absolute/path/to/new-release.tar.gz" >&2; exit 2;
}
cd "${REPO_ROOT}"
paths=(backend web-client scripts .node-version)
git diff --quiet HEAD -- "${paths[@]}" || { echo "Commit the validated application changes first" >&2; exit 1; }
[[ -z "$(git ls-files --others --exclude-standard -- "${paths[@]}")" ]] || {
  echo "Untracked application files must be reviewed and committed first" >&2; exit 1;
}
files="$(git ls-tree -r --name-only HEAD -- "${paths[@]}")"
if printf '%s\n' "${files}" | grep -E '(^|/)(\.secrets|\.env($|\.)|storage|node_modules|coverage|dist)(/|$|\.)' | grep -vE '(^|/)\.env\.example$' >/dev/null; then
  echo "Unexpected private or generated path in the release tree" >&2; exit 1;
fi
temporary="$(mktemp "${output}.pending.XXXXXX")"
trap 'rm -f -- "${temporary}"' EXIT
git archive --format=tar.gz --output="${temporary}" HEAD -- "${paths[@]}"
mv -- "${temporary}" "${output}"
git rev-parse HEAD
sha256sum "${output}"

#!/usr/bin/env bash
set -euo pipefail

BASHRC="$HOME/.bashrc"
RTK_CONFIG_DIR="$HOME/.config/rtk"
RTK_DATA_DIR="$HOME/.local/share/rtk"
UV_CACHE_DIR="${UV_CACHE_DIR:-$HOME/.cache/uv}"
NPM_CACHE_DIR="$HOME/.npm"
CODEX_HOME_DIR="$HOME/.codex"

announce() {
  printf '\n== %s ==\n' "$1"
}

ensure_owned_directory() {
  local directory="$1"

  sudo mkdir -p "$directory"
  if [ ! -w "$directory" ]; then
    sudo chown "$(id -u):$(id -g)" "$directory"
  fi
}

append_once() {
  local marker="$1"
  local content="$2"
  if ! grep -Fq "$marker" "$BASHRC" 2>/dev/null; then
    {
      echo
      echo "$marker"
      printf '%s\n' "$content"
    } >> "$BASHRC"
  fi
}

announce "Enabling bash-completion"
append_once "# >>> mewtwo bash completion >>>" '
# Enable system bash completion.
if [ -f /usr/share/bash-completion/bash_completion ]; then
  . /usr/share/bash-completion/bash_completion
elif [ -f /etc/bash_completion ]; then
  . /etc/bash_completion
fi
# Enable npm completion, including package scripts for `npm run <tab>`.
if command -v npm >/dev/null 2>&1; then
  source <(npm completion 2>/dev/null) || true
fi
# Useful completion defaults.
bind "set completion-ignore-case on"
bind "set show-all-if-ambiguous on"
bind "set menu-complete-display-prefix on"
'

announce "Preparing persisted tool directories"
for directory in "$RTK_CONFIG_DIR" "$RTK_DATA_DIR" "$RTK_DATA_DIR/tee" "$RTK_DATA_DIR/db" "$UV_CACHE_DIR" "$NPM_CACHE_DIR" "$CODEX_HOME_DIR"; do
  ensure_owned_directory "$directory"
done

if [ -f ".devcontainer/rtk/config.toml" ] && [ ! -f "$RTK_CONFIG_DIR/config.toml" ]; then
  announce "Installing initial RTK config"
  cp ".devcontainer/rtk/config.toml" "$RTK_CONFIG_DIR/config.toml"
fi

announce "Initializing RTK for Codex"
echo "Running: printf 'N\\n' | RTK_TELEMETRY_DISABLED=1 rtk init -g --codex"
printf 'N\n' | RTK_TELEMETRY_DISABLED=1 rtk init -g --codex || true

announce "Checking required runtime commands"
bash .devcontainer/scripts/check-runtime-deps.sh || true

announce "Showing container resource limits"
bash .devcontainer/scripts/show-resource-status.sh || true

announce "Checking SSH agent forwarding"
if [ -n "${SSH_AUTH_SOCK:-}" ]; then
  ssh-add -l || true
else
  echo "SSH_AUTH_SOCK is not set. If ops SSH fails, check VS Code SSH agent forwarding."
fi

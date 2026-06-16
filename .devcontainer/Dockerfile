FROM debian:13.5-slim

ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=1000

ENV DEBIAN_FRONTEND=noninteractive
ENV SHELL=/bin/bash
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# Base Linux, ops, SSH, archive, checksum, search, and debugging tools.
# This group supports repo scripts under ops/* and src/_scripts/*.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  bash \
  bash-completion \
  bubblewrap \
  ca-certificates \
  coreutils \
  curl \
  fd-find \
  findutils \
  git \
  grep \
  gzip \
  iproute2 \
  jq \
  lsof \
  mawk \
  openssh-client \
  procps \
  ripgrep \
  sed \
  sudo \
  tar \
  unzip \
  util-linux \
  xz-utils \
  && rm -rf /var/lib/apt/lists/*

# Native Node.js addon build support.
# Keep this separate so it is obvious what can be removed if the repo stays pure JS/TS.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  build-essential \
  libssl-dev \
  pkg-config \
  python3 \
  zlib1g-dev \
  && rm -rf /var/lib/apt/lists/*

RUN ln -sf /usr/bin/fdfind /usr/local/bin/fd

RUN set -eux; \
  mkdir -p /usr/local/share/devcontainer; \
  echo "debian:13.5-slim" > /usr/local/share/devcontainer/base-image.name; \
  token="$(curl -fsSL "https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/debian:pull" | jq -r '.token')"; \
  digest="$(curl -fsSI \
  -H "Authorization: Bearer ${token}" \
  -H "Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json" \
  "https://registry-1.docker.io/v2/library/debian/manifests/13.5-slim" \
  | awk -F': ' 'tolower($1)=="docker-content-digest" { gsub("\r", "", $2); print $2; exit }')"; \
  test -n "${digest}"; \
  echo "${digest}" > /usr/local/share/devcontainer/base-image.digest

RUN groupadd --gid ${USER_GID} ${USERNAME} \
  && useradd --uid ${USER_UID} --gid ${USER_GID} -m ${USERNAME} -s /bin/bash \
  && echo "${USERNAME} ALL=(root) NOPASSWD:ALL" > /etc/sudoers.d/${USERNAME} \
  && chmod 0440 /etc/sudoers.d/${USERNAME} \
  && mkdir -p /home/${USERNAME}/.codex \
  && mkdir -p /home/${USERNAME}/.config/rtk /home/${USERNAME}/.local/share/rtk \
  && mkdir -p /home/${USERNAME}/.cache/uv /home/${USERNAME}/.npm \
  && chown -R ${USERNAME}:${USERNAME} \
  /home/${USERNAME}/.codex \
  /home/${USERNAME}/.config \
  /home/${USERNAME}/.local \
  /home/${USERNAME}/.cache \
  /home/${USERNAME}/.npm

COPY .node-version /usr/local/share/devcontainer/node-version
COPY .devcontainer/versions.env /usr/local/share/devcontainer/versions.env

RUN set -eux; \
  . /usr/local/share/devcontainer/versions.env; \
  NODE_VERSION="$(tr -d '[:space:]' < /usr/local/share/devcontainer/node-version)"; \
  arch="$(dpkg --print-architecture)"; \
  case "$arch" in \
  amd64) node_arch="x64" ;; \
  arm64) node_arch="arm64" ;; \
  *) echo "Unsupported architecture for Node.js: $arch" >&2; exit 1 ;; \
  esac; \
  node_base="node-v${NODE_VERSION}-linux-${node_arch}"; \
  cd /tmp; \
  curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/${node_base}.tar.xz"; \
  curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"; \
  grep " ${node_base}.tar.xz$" SHASUMS256.txt | sha256sum -c -; \
  mkdir -p /opt/node; \
  tar -xJf "${node_base}.tar.xz" -C /opt/node --strip-components=1; \
  ln -sf /opt/node/bin/node /usr/local/bin/node; \
  ln -sf /opt/node/bin/npm /usr/local/bin/npm; \
  ln -sf /opt/node/bin/npx /usr/local/bin/npx; \
  ln -sf /opt/node/bin/corepack /usr/local/bin/corepack; \
  rm -f "/tmp/${node_base}.tar.xz" /tmp/SHASUMS256.txt; \
  npm install -g "npm@${NPM_VERSION}"; \
  corepack enable; \
  node --version; \
  npm --version

USER ${USERNAME}
WORKDIR /home/${USERNAME}

ENV PATH="/home/${USERNAME}/.local/bin:${PATH}"
ENV UV_INSTALL_DIR="/home/${USERNAME}/.local/bin"
ENV UV_TOOL_DIR="/home/${USERNAME}/.local/share/uv/tools"
ENV UV_PYTHON_INSTALL_DIR="/home/${USERNAME}/.local/share/uv/python"
ENV UV_CACHE_DIR="/home/${USERNAME}/.cache/uv"
ENV NPM_CONFIG_PREFIX="/home/${USERNAME}/.local"

RUN set -eux; \
  . /usr/local/share/devcontainer/versions.env; \
  curl -LsSf "https://astral.sh/uv/${UV_VERSION}/install.sh" | sh; \
  uv tool install -p 3.13 "serena-agent==${SERENA_VERSION}"; \
  curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh -o /tmp/rtk-install.sh; \
  RTK_INSTALL_DIR="/home/${USERNAME}/.local/bin" RTK_VERSION="${RTK_VERSION}" sh /tmp/rtk-install.sh; \
  rm -f /tmp/rtk-install.sh; \
  npm install -g \
  "@ast-grep/cli@${AST_GREP_CLI_VERSION}" \
  "repomix@${REPOMIX_VERSION}"; \
  uv --version; \
  serena --version; \
  rtk --version; \
  ast-grep --version; \
  repomix --version

WORKDIR /workspaces/mewtwo

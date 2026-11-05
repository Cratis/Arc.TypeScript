#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

# Shared helpers for the sample run scripts. Source it; do not run it.
#
#   . "$(dirname "${BASH_SOURCE[0]}")/../_common.sh"
#
# Prerequisites it checks for you:
#   Node.js 22.19+ and Yarn 4 (run `corepack enable` once if `yarn` is missing)
#   Docker, only where a sample needs Chronicle or MongoDB

samples_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$samples_dir/.." && pwd)"

die() { printf '%s\n' "$*" >&2; exit 1; }

require_tools() {
  command -v node >/dev/null 2>&1 || die "Node.js 22.19+ is required but 'node' was not found."
  node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 19) ? 0 : 1)' ||
    die "Node.js 22.19+ is required (found $(node -v))."
  command -v yarn >/dev/null 2>&1 ||
    die "Yarn 4 is required but 'yarn' was not found. Run 'corepack enable' once, then try again."
}

# Install the workspace dependencies when they are missing.
ensure_install() {
  if [ ! -d "$repo_root/node_modules" ]; then
    echo "Installing dependencies (yarn install --immutable)..."
    (cd "$repo_root" && yarn install --immutable)
  fi
}

# Build the framework packages a sample references: build_libraries Source/Core Source/Express ...
build_libraries() { (cd "$repo_root" && yarn tsc -b "$@"); }

have_docker() { command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; }

require_docker() {
  have_docker || die "Docker is required for $1 but it is not available. Start Docker Desktop (or the Docker daemon) and try again."
}

# Wait until a TCP port on 127.0.0.1 accepts connections: wait_for_port <port> <seconds> <name>
wait_for_port() {
  local port="$1" seconds="$2" name="$3" attempt
  for ((attempt = 0; attempt < seconds; attempt++)); do
    if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then return 0; fi
    sleep 1
  done
  die "$name did not answer on 127.0.0.1:$port within ${seconds}s."
}

port_open() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

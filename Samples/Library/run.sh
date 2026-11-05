#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

# Library: an event-sourced Arc application (Chronicle, Express, React). The Chronicle integration is experimental.
#
# Usage: ./run.sh [start|dev|test|e2e]
#   start  starts Chronicle (docker compose), builds the sample and runs the backend on
#          http://127.0.0.1:3000 together with the Vite web app on http://127.0.0.1:5173
#          (the backend does not serve the web app, so start and dev run the same thing)
#   dev    the same, with the proxy generator and the backend watching for changes
#   test   builds, regenerates the proxies, lints and runs the backend and web specifications
#          (they use Chronicle's in-memory test kernels, so no Docker is needed)
#   e2e    runs the end-to-end suite against a throwaway Chronicle container (needs Docker)
# CHRONICLE_URL overrides the connection string. Stop Chronicle again with
#   docker compose -f Samples/Library/docker-compose.yml down
# Requires Node.js 22.19+, Yarn 4 and, to run the sample, Docker.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/../_common.sh"
cd "$repo_root"

require_tools
ensure_install

chronicle() {
  if [ -n "${CHRONICLE_URL:-}" ]; then return 0; fi
  require_docker "Chronicle"
  docker compose -f Samples/Library/docker-compose.yml up -d
  wait_for_port 35000 90 Chronicle
}

case "${1:-start}" in
  start|dev)
    chronicle
    exec yarn workspace @cratis/arc.sample.library dev
    ;;
  test)
    build_libraries Source/Core Source/Testing Source/Express Source/Chronicle Source/Tools/ProxyGenerator
    yarn workspace @cratis/arc.sample.library generate-proxies
    node Samples/check-slices.mjs Library
    yarn tsc -b Samples/Library
    yarn eslint Samples/Library
    yarn vitest run Samples/Library
    yarn workspace @cratis/arc.sample.library.web build
    ;;
  e2e)
    require_docker "the Library end-to-end suite"
    yarn workspace @cratis/arc.sample.library test:e2e
    ;;
  *) die "Usage: ./run.sh [start|dev|test|e2e]" ;;
esac

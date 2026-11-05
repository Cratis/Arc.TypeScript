#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

# Showcase: the Arc samples (ticker, live feed, queries, authentication, authorization, collections,
# MongoDB with tenancy) as vertical slices under Features/, plus a React shell in Web/.
#
# Usage: ./run.sh [start|dev|test]
#   start  starts MongoDB (docker compose), builds the server and the React app and serves
#          everything from http://127.0.0.1:${PORT:-3002}   (also the default)
#   dev    runs the server and the proxy generator watching for changes plus Vite on http://127.0.0.1:5174
#   test   regenerates the proxies, type-checks, lints and runs the specifications and builds the web app;
#          the MongoDB specs run when ARC_MONGO_TEST_URI points at a replica set and are skipped otherwise
# MONGODB_URL (default mongodb://127.0.0.1:${MONGODB_PORT:-27017}/?replicaSet=rs0&directConnection=true) selects another MongoDB;
# MONGODB_PORT moves the compose container. Without MongoDB every page works except the MongoDB one.
# Stop MongoDB again with: docker compose -f Samples/Showcase/docker-compose.yml down
# Requires Node.js 22.19+, Yarn 4 and, for the MongoDB page, Docker.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/../_common.sh"
cd "$repo_root"

require_tools
ensure_install

libraries=(Source/Core Source/Express Source/MongoDB Source/Tools/ProxyGenerator)

mongo() {
  if [ -n "${MONGODB_URL:-}" ]; then return 0; fi
  if have_docker; then
    docker compose -f Samples/Showcase/docker-compose.yml up -d --wait ||
      echo "MongoDB did not start (is port ${MONGODB_PORT:-27017} taken?). The MongoDB page will not work." >&2
  else
    echo "Docker is not available: every page works except the MongoDB one, which needs a replica set." >&2
  fi
}

case "${1:-start}" in
  start)
    mongo
    build_libraries "${libraries[@]}"
    yarn workspace @cratis/arc.sample.showcase build
    echo "Showcase on http://127.0.0.1:${PORT:-3002}"
    exec yarn workspace @cratis/arc.sample.showcase start
    ;;
  dev)
    mongo
    exec yarn workspace @cratis/arc.sample.showcase dev
    ;;
  test)
    build_libraries "${libraries[@]}" Source/Testing
    yarn workspace @cratis/arc.sample.showcase generate-proxies
    node Samples/check-slices.mjs Showcase
    yarn workspace @cratis/arc.sample.showcase check-metadata
    yarn workspace @cratis/arc.sample.showcase typecheck
    yarn eslint Samples/Showcase
    yarn workspace @cratis/arc.sample.showcase test
    yarn workspace @cratis/arc.sample.showcase build:web
    ;;
  *) die "Usage: ./run.sh [start|dev|test]" ;;
esac

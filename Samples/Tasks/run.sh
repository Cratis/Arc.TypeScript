#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

# Tasks: the smallest Arc for TypeScript application (no Chronicle, no database, no Docker).
#
# Usage: ./run.sh [start|test]
#   start  builds the sample and serves http://127.0.0.1:${PORT:-3000}   (also the default)
#   test   checks the slice layout, regenerates the proxies and metadata, lints the sample and runs its specifications
# There is no dev mode: Tasks has no UI. Requires Node.js 22.19+ and Yarn 4.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/../_common.sh"
cd "$repo_root"

require_tools
ensure_install

case "${1:-start}" in
  start)
    build_libraries Source/Core Source/Tools/ProxyGenerator
    yarn workspace @cratis/arc.core.sample.tasks generate-proxies
    yarn tsc -b Samples/Tasks
    echo "Tasks listening on http://127.0.0.1:${PORT:-3000}  (try: curl http://127.0.0.1:${PORT:-3000}/api/tasks/listing/all-tasks)"
    exec yarn workspace @cratis/arc.core.sample.tasks start
    ;;
  test)
    build_libraries Source/Core Source/Testing Source/Tools/ProxyGenerator
    yarn workspace @cratis/arc.core.sample.tasks generate-proxies
    node Samples/check-slices.mjs Tasks
    node Samples/Tasks/check-metadata.mjs
    yarn tsc -b Samples/Tasks
    yarn eslint Samples/Tasks
    yarn vitest run Samples/Tasks
    ;;
  *) die "Usage: ./run.sh [start|test]" ;;
esac

#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
set -euo pipefail
cd "$(dirname "$0")/../.."
if ! docker info >/dev/null; then
    printf '%s\n' 'Docker unavailable: Library integration could not run' >&2
    exit 2
fi
container_id=''
cleanup() {
    if [ -n "$container_id" ]; then
        docker stop "$container_id" >/dev/null
        docker rm "$container_id" >/dev/null
        container_id=''
    fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

yarn workspace @cratis/arc.sample.library build
container_id=$(docker run -d --name "arc-library-chronicle-$$" -p 127.0.0.1::35000 cratis/chronicle:latest-development)
port=$(docker port "$container_id" 35000/tcp)
ready=0
for attempt in $(seq 1 90); do
    if curl -kfsS --max-time 2 "https://localhost:${port##*:}/" >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
done
if [ "$ready" -ne 1 ]; then
    printf '%s\n' 'Library Chronicle kernel was not ready' >&2
    docker logs "$container_id" >&2
    exit 2
fi
CHRONICLE_URL="chronicle://localhost:${port##*:}" \
    node --import tsx --test --test-force-exit Samples/Library/e2e.test.mjs

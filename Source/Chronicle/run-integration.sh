#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
set -euo pipefail
cd "$(dirname "$0")/../.."
if [ -z "${ARC_CHRONICLE_TEST_URL:-}" ]; then
    if ! docker info >/dev/null; then
        printf '%s\n' 'Docker unavailable: Chronicle kernel integration could not run' >&2
        exit 2
    fi
    name="arcts-chronicle-kernel-$$"
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
    container_id=$(docker run -d --name "$name" -p 127.0.0.1::35000 cratis/chronicle:latest-development)
    port=$(docker port "$container_id" 35000/tcp)
    ARC_CHRONICLE_TEST_URL="chronicle://localhost:${port##*:}"
    export ARC_CHRONICLE_TEST_URL
    ready=0
    for attempt in $(seq 1 90); do
        if curl -kfsS --max-time 2 "https://localhost:${port##*:}/" >/dev/null 2>&1; then
            ready=1
            break
        fi
        sleep 1
    done
    if [ "$ready" -ne 1 ]; then
        printf '%s\n' 'Chronicle kernel did not become ready within 90 seconds' >&2
        docker logs "$container_id" >&2
        exit 2
    fi
fi
yarn build
if [ "${ARC_CHRONICLE_TEST_SUITE:-}" = 'kernel-scenarios' ]; then
    yarn workspace @cratis/arc.sample.library generate-proxies
    yarn tsc -b Samples/Library
    node --test Samples/Library/kernel-scenarios.test.mjs
else
    # The SDK's reactor observation can keep a gRPC socket open after disposal.
    node --test --test-force-exit Source/Chronicle/Integration/live.test.mjs
fi

#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
set -euo pipefail
cd "$(dirname "$0")/../.."
if ! docker info >/dev/null; then
    printf '%s\n' 'Docker unavailable: PostgreSQL integration was not run' >&2
    exit 2
fi
name="arc-drizzle-postgres-$$"
container_id=''
cleanup() {
    if [ -n "$container_id" ]; then
        docker rm -f "$container_id" >/dev/null
        container_id=''
    fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
container_id=$(docker run --rm -d --name "$name" -e POSTGRES_PASSWORD=arc_test -e POSTGRES_DB=arc_test -p 127.0.0.1::5432 postgres:16-alpine)
ready=0
for attempt in $(seq 1 60); do
    if docker exec "$container_id" pg_isready -h 127.0.0.1 -U postgres -d arc_test >/dev/null; then
        ready=1
        break
    fi
    sleep 1
done
if [ "$ready" -ne 1 ]; then
    printf '%s\n' 'PostgreSQL did not become ready within 60 seconds' >&2
    docker logs "$container_id" >&2
    exit 2
fi
port=$(docker port "$container_id" 5432/tcp)
port=${port##*:}
ARC_POSTGRES_TEST_URI="postgres://postgres:arc_test@127.0.0.1:$port/arc_test" yarn vitest run --config Source/Drizzle/vitest.integration.config.ts

#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
set -euo pipefail
cd "$(dirname "$0")/../.."
if ! docker info >/dev/null; then
    printf '%s\n' 'Docker unavailable: PostgreSQL and MySQL integrations were not run' >&2
    exit 2
fi
postgres_id=''
mysql_id=''
cleanup() {
    status=$?
    trap - EXIT
    if [ -n "$mysql_id" ] && ! docker rm -f "$mysql_id" >/dev/null; then
        printf '%s\n' "Failed to remove MySQL container $mysql_id" >&2
        status=2
    fi
    if [ -n "$postgres_id" ] && ! docker rm -f "$postgres_id" >/dev/null; then
        printf '%s\n' "Failed to remove PostgreSQL container $postgres_id" >&2
        status=2
    fi
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if ! postgres_id=$(docker run --rm -d --name "arc-drizzle-postgres-$$" -e POSTGRES_PASSWORD=arc_test \
    -e POSTGRES_DB=arc_test -p 127.0.0.1::5432 postgres:16-alpine); then
    printf '%s\n' 'Could not start PostgreSQL integration container' >&2
    exit 2
fi
postgres_ready=0
for attempt in $(seq 1 60); do
    if docker exec "$postgres_id" pg_isready -h 127.0.0.1 -U postgres -d arc_test >/dev/null; then
        postgres_ready=1
        break
    fi
    sleep 1
done
if [ "$postgres_ready" -ne 1 ]; then
    printf '%s\n' 'PostgreSQL did not become ready within 60 seconds' >&2
    docker logs "$postgres_id" >&2
    exit 2
fi
if ! mysql_id=$(docker run --rm -d --name "arc-drizzle-mysql-$$" -e MYSQL_ROOT_PASSWORD=arc_test \
    -e MYSQL_DATABASE=arc_test -p 127.0.0.1::3306 mysql:8.4); then
    printf '%s\n' 'Could not start MySQL integration container' >&2
    exit 2
fi
mysql_ready=0
for attempt in $(seq 1 90); do
    if docker exec "$mysql_id" mysql -h 127.0.0.1 -uroot -parc_test arc_test -e 'select 1' >/dev/null 2>&1; then
        mysql_ready=1
        break
    fi
    sleep 1
done
if [ "$mysql_ready" -ne 1 ]; then
    printf '%s\n' 'MySQL did not become ready within 90 seconds' >&2
    docker logs "$mysql_id" >&2
    exit 2
fi
postgres_port=$(docker port "$postgres_id" 5432/tcp)
postgres_port=${postgres_port##*:}
mysql_port=$(docker port "$mysql_id" 3306/tcp)
mysql_port=${mysql_port##*:}
ARC_POSTGRES_TEST_URI="postgres://postgres:arc_test@127.0.0.1:$postgres_port/arc_test" \
ARC_MYSQL_TEST_URI="mysql://root:arc_test@127.0.0.1:$mysql_port/arc_test" \
    yarn vitest run --config Source/Drizzle/vitest.integration.config.ts

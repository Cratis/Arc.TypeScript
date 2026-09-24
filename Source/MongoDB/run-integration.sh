#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
set -euo pipefail
cd "$(dirname "$0")/../.."
if ! docker info >/dev/null; then
    printf '%s\n' 'Docker unavailable: MongoDB integration was not run' >&2
    exit 2
fi
name="arc-mongodb-integration-$$"
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
container_id=$(docker run --rm -d --name "$name" -p 127.0.0.1::27017 mongo:7 --replSet rs0 --bind_ip_all)
ready=0
for attempt in $(seq 1 60); do
    if docker exec "$container_id" mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})' >/dev/null; then
        break
    fi
    sleep 1
done
for attempt in $(seq 1 60); do
    if [ "$(docker exec "$container_id" mongosh --quiet --eval 'db.hello().isWritablePrimary')" = 'true' ]; then
        ready=1
        break
    fi
    sleep 1
done
if [ "$ready" -ne 1 ]; then
    printf '%s\n' 'MongoDB replica set did not become writable within 60 seconds' >&2
    docker logs "$container_id" >&2
    exit 2
fi
port=$(docker port "$container_id" 27017/tcp)
port=${port##*:}
ARC_MONGO_TEST_URI="mongodb://127.0.0.1:$port/?replicaSet=rs0&directConnection=true" yarn vitest run --config Source/MongoDB/vitest.integration.config.ts

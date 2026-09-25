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
container_id=$(docker run -d --name "arc-library-mongo-$$" -p 127.0.0.1::27017 mongo:7.0 --replSet rs0 --bind_ip_all)
ready=0
for attempt in $(seq 1 60); do
    if docker exec "$container_id" mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})' >/dev/null 2>&1; then break; fi
    sleep 1
done
for attempt in $(seq 1 60); do
    if [ "$(docker exec "$container_id" mongosh --quiet --eval 'db.hello().isWritablePrimary')" = 'true' ]; then ready=1; break; fi
    sleep 1
done
if [ "$ready" -ne 1 ]; then printf '%s\n' 'Library MongoDB replica set was not ready' >&2; exit 2; fi
port=$(docker port "$container_id" 27017/tcp)
MONGODB_URL="mongodb://127.0.0.1:${port##*:}/?replicaSet=rs0&directConnection=true" CHRONICLE_URL='' \
    node --import tsx --test --test-force-exit Samples/Library/e2e.test.mjs
cleanup

container_id=$(docker run -d --name "arc-library-chronicle-$$" -p 127.0.0.1::35000 cratis/chronicle:latest-development)
port=$(docker port "$container_id" 35000/tcp)
ready=0
for attempt in $(seq 1 90); do
    if curl -kfsS --max-time 2 "https://localhost:${port##*:}/" >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
done
if [ "$ready" -ne 1 ]; then printf '%s\n' 'Library Chronicle kernel was not ready' >&2; exit 2; fi
CHRONICLE_URL="chronicle://localhost:${port##*:}" MONGODB_URL='' \
    node --import tsx --test --test-force-exit Samples/Library/e2e.test.mjs

#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
set -euo pipefail
repo=$(cd "$(dirname "$0")/../.." && pwd)
arc_docs=${ARC_DOCUMENTATION:-"$repo/../Arc/Documentation"}
if [ ! -f "$arc_docs/tutorial/first-slice.mdx" ]; then
    printf '%s\n' 'ARC_DOCUMENTATION must name the shared Arc Documentation directory' >&2
    exit 2
fi
if ! docker info >/dev/null 2>&1; then
    printf '%s\n' 'Docker unavailable: tutorial e2e needs a MongoDB replica set' >&2
    exit 2
fi
scratch_parent=${TUTORIAL_SCRATCH_PARENT:-"${TMPDIR:-/tmp}"}
mkdir -p "$scratch_parent"
scratch=$(mktemp -d "$scratch_parent/arc-tutorial-2844.XXXXXX")
container=''
server=''
cleanup() {
    if [ -n "$server" ]; then kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true; fi
    if [ -n "$container" ]; then docker stop "$container" >/dev/null 2>&1 || true; docker rm --volumes "$container" >/dev/null 2>&1 || true; fi
    # The only removed tree was created above by mktemp for this run.
    rm -rf -- "$scratch"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
python3 "$repo/Documentation/tutorial-e2e/assemble.py" --self-test
python3 "$repo/Documentation/tutorial-e2e/assemble.py" "$scratch/app" --arc-documentation "$arc_docs"
mkdir -p "$scratch/arc-packages"
for package in core mongodb proxygenerator; do
    yarn workspace "@cratis/arc.$package" pack --out "$scratch/arc-packages/arc.$package.tgz" >/dev/null
    printf 'Packed @cratis/arc.%s\n' "$package"
done
cd "$scratch/app"
npm install --no-audit --no-fund ../arc-packages/arc.core.tgz ../arc-packages/arc.mongodb.tgz \
    @cratis/fundamentals@7.19.6 @opentelemetry/api@1.9.1 mongodb@6.21.0 rxjs@7.8.2 \
    react@19.3.0 react-dom@19.3.0 @cratis/arc@22.19.1 @cratis/arc.react@22.19.1 @cratis/components@4.6.0 \
    reflect-metadata@0.2.2 tsyringe@4.10.0
npm install --no-audit --no-fund --save-dev ../arc-packages/arc.proxygenerator.tgz \
    typescript@npm:@typescript/typescript6@6.0.2 @types/node@22.20.4 tsx@4.23.15 vite@8.3.0 \
    @types/react@19.3.0 @types/react-dom@19.3.0
npm run generate
npm run build
test -f dist/main.js
echo 'PASS generated proxies and dist/main.js'
./node_modules/.bin/tsc6 -p tsconfig.web.json --noEmit
./node_modules/.bin/vite build
test -f dist-web/index.html
echo 'PASS browser typecheck and vite build'
npm ls @cratis/arc.core @cratis/arc.mongodb
# An isolated single-node replica set. MongoDB binds only the Docker loopback
# interface; port 27017 is not published outside the host loopback.
container=$(docker run -d --name "arc-tutorial-2844-$$" -p 127.0.0.1::27017 mongo:7 \
    --replSet rs0 --bind_ip_all)
port=$(docker port "$container" 27017/tcp)
port=${port##*:}
ready=0
for attempt in $(seq 1 60); do
    if docker exec "$container" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1; then ready=1; break; fi
    sleep 1
done
if [ "$ready" -ne 1 ]; then docker logs "$container" >&2; exit 2; fi
docker exec "$container" mongosh --quiet --eval \
    "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})" >/dev/null
for attempt in $(seq 1 60); do
    if docker exec "$container" mongosh --quiet --eval 'db.hello().isWritablePrimary' | grep -qx true; then ready=1; break; fi
    ready=0
    sleep 1
done
if [ "$ready" -ne 1 ]; then docker logs "$container" >&2; exit 2; fi
backend_port=$(node -e "const s=require('node:net').createServer(); s.listen(0, '127.0.0.1', () => { console.log(s.address().port); s.close(); });")
MONGODB_URI="mongodb://127.0.0.1:$port/?directConnection=true" NODE_ENV=development \
    TUTORIAL_DATABASE="arc_tutorial_2844_$$" PORT="$backend_port" node dist/main.js >"$scratch/backend.log" 2>&1 &
server=$!
for attempt in $(seq 1 80); do
    if curl -fsS --max-time 2 http://127.0.0.1:$backend_port/.cratis/commands >/dev/null 2>&1; then ready=1; break; fi
    if ! kill -0 "$server" 2>/dev/null; then break; fi
    ready=0
    sleep 0.25
done
if [ "$ready" -ne 1 ]; then printf 'Backend failed to start:\n' >&2; cat "$scratch/backend.log" >&2; exit 1; fi
TUTORIAL_PORT="$backend_port" node "$repo/Documentation/tutorial-e2e/check.mjs" || { cat "$scratch/backend.log" >&2; exit 1; }

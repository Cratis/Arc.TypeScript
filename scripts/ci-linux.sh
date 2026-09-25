#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
set -euo pipefail

cd "$(dirname "$0")/.."
if [[ -n "$(git status --porcelain)" ]]; then
    printf 'Commit changes before running ci:linux; it checks a fresh clone of HEAD.\n' >&2
    exit 2
fi

branch=$(git branch --show-current)
clone=$(mktemp -d /tmp/arc-ci-linux-XXXXXXXX)
container="arc-ci-linux-$$"
cleanup() {
    if docker ps --format '{{.Names}}' | grep -Fxq "$container" ||
        ! command -v lsof >/dev/null || lsof -t +D "$clone" >/dev/null 2>&1 ||
        [[ -n "$(git -C "$clone" status --porcelain 2>/dev/null)" ]]; then
        printf 'Container, process, or changes still hold %s; leaving the clone intact.\n' "$clone" >&2
    else
        rm -rf -- "$clone"
    fi
}
trap cleanup EXIT

git clone --quiet --no-local --single-branch --branch "$branch" "$PWD" "$clone"
network=()
if [[ "$(uname -s)" == Darwin ]]; then
    network=(-e CHRONICLE_HOST=host.docker.internal)
else
    network=(--network host)
fi
docker run --rm --name "$container" --mount "type=bind,src=$clone,dst=/workspace" \
    --mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
    "${network[@]}" --workdir /workspace node:22.19.0 \
    sh -lc 'apt-get update -qq && apt-get install -y -qq --no-install-recommends docker.io lsof curl && corepack enable && yarn install --immutable && yarn ci'

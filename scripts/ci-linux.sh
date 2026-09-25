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
    if docker ps --format '{{.Names}}' | grep -Fxq "$container"; then
        printf 'Container %s still holds %s; leaving the clone intact.\n' "$container" "$clone" >&2
    else
        rm -rf -- "$clone"
    fi
}
trap cleanup EXIT

git clone --quiet --no-local --single-branch --branch "$branch" "$PWD" "$clone"
docker run --rm --name "$container" --mount "type=bind,src=$clone,dst=/workspace" --workdir /workspace node:22.19.0 \
    sh -lc 'apt-get update -qq && apt-get install -y -qq --no-install-recommends lsof && corepack enable && yarn install --immutable && yarn ci'

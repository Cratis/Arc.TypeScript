#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
# Reads changed file paths (one per line) from stdin and prints the CI job selection as
# key=value lines. An empty list (for example a pull request whose changes are already on
# the base branch) selects nothing, so every downstream job is skipped.
set -euo pipefail

code=false
drizzle=false
tutorial=false
docs=false
seen=false

while IFS= read -r file || [[ -n "$file" ]]; do
    [[ -z "$file" ]] && continue
    seen=true
    case "$file" in
        Documentation/client-snippets/tutorial/*|Documentation/client-snippets/arc-without-event-sourcing/*|Documentation/tutorial-e2e/*|Documentation/validate-client-snippets.py|Source/MongoDB/*|Source/Core/*|Source/Tools/ProxyGenerator/*|.github/workflows/ci.yml|package.json|yarn.lock) tutorial=true ;;
    esac
    case "$file" in
        Source/Drizzle/*|Documentation/sql/observing-postgresql.md|.github/workflows/ci.yml|package.json|yarn.lock) drizzle=true ;;
    esac
    case "$file" in
        Documentation/*|*.md) ;;
        *) code=true ;;
    esac
done

if [[ "$seen" == true && "$code" == false ]]; then
    docs=true
fi

printf 'code=%s\ndrizzle=%s\ntutorial=%s\ndocs=%s\n' "$code" "$drizzle" "$tutorial" "$docs"

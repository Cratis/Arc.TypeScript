#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

# Builds and tests every sample against the Arc source in this repository.
#
#   Tasks     the smallest Arc application, no Chronicle
#   Library   Chronicle, Express and React; its specifications use in-memory test kernels
#   Showcase  the vertical-slice showcase; its MongoDB specs run when ARC_MONGO_TEST_URI answers
#             and are skipped otherwise
#
# Set ARC_SAMPLES_E2E=1 to also run the Library end-to-end suite (needs Docker).
# Requires Node.js 22.19+ and Yarn 4 (run `corepack enable` once if `yarn` is missing).
set -euo pipefail

samples="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for sample in Tasks Library Showcase; do
  echo "== $sample"
  "$samples/$sample/run.sh" test
done

if [ "${ARC_SAMPLES_E2E:-0}" = "1" ]; then
  echo "== Library end to end"
  "$samples/Library/run.sh" e2e
fi

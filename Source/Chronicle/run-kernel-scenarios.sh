#!/usr/bin/env bash
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
set -euo pipefail
export ARC_CHRONICLE_TEST_SUITE=kernel-scenarios
exec "$(dirname "$0")/run-integration.sh"

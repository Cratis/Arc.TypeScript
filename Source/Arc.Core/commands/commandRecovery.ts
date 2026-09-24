// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from './CommandResult.js';
import type { CommandRecoverySummary } from './CommandRecoverySummary.js';
import type { CommandOperationOutcome } from './CommandOperationOutcome.js';
/** Attach diagnostics without making them enumerable HTTP response fields. */
export function setCommandRecovery(result: CommandResult, recovery: CommandRecoverySummary, outcomes: readonly CommandOperationOutcome[]): void {
    Object.defineProperties(result, {
        recovery: { value: recovery, enumerable: false },
        operationOutcomes: { value: outcomes, enumerable: false }
    });
}

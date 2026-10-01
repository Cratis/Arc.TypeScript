// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from '../commands/CommandResult.js';
import type { QueryResult } from '../queries/QueryResult.js';
import { OperationOutcome } from './OperationOutcome.js';

/** Match .NET OperationOutcomes: authorization, exceptions, then validation reasons. */
export function classifyOperationOutcome(result: CommandResult | QueryResult | undefined, signal: AbortSignal): OperationOutcome {
    if (result && !result.isAuthorized) return OperationOutcome.Authorization;
    if (!result || result.hasExceptions) return signal.aborted ? OperationOutcome.Cancelled : OperationOutcome.Error;
    if (!result.validationResults.length) return OperationOutcome.Success;
    return result.validationResults.some(issue => issue.reason === 'constraintViolation' || issue.reason === 'concurrencyViolation')
        ? OperationOutcome.AppendRejected : OperationOutcome.Validation;
}

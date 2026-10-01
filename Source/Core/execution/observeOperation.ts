// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from '../commands/CommandResult.js';
import type { QueryResult } from '../queries/QueryResult.js';
import type { ExecutionContext } from './ExecutionContext.js';
import { observe } from './observability.js';
import { classifyOperationOutcome } from './classifyOperationOutcome.js';
import { QueryTransport } from './QueryTransport.js';
import { WellKnownTelemetryNames } from './WellKnownTelemetryNames.js';

/** Measure the completed pipeline result, not a transport's status code or individual emissions. */
export function observeOperation<T extends CommandResult | QueryResult>(name: string, context: ExecutionContext,
    qualifiedName: string, callback: () => Promise<T>, observable = false): Promise<T> {
    const query = name === WellKnownTelemetryNames.queryPerformSpan;
    return observe(name, context.correlationId, query ? { query_name: qualifiedName } : { command_type: qualifiedName },
        callback, undefined, result => result.hasExceptions, result => {
            const outcome = classifyOperationOutcome(result, context.signal);
            if (!query) return { [WellKnownTelemetryNames.commandOutcome]: outcome };
            const data = result && 'data' in result ? result.data : undefined;
            const transport = data == null ? (result?.isSuccess ? QueryTransport.Snapshot : QueryTransport.Unknown)
                : observable ? QueryTransport.Observable : QueryTransport.Snapshot;
            return { [WellKnownTelemetryNames.queryOutcome]: outcome, [WellKnownTelemetryNames.queryTransport]: transport };
        });
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandContext, CommandPipelineFilter, QueryContext, QueryPipelineFilter } from '@cratis/arc.core';
import { recordFilterParity } from './FilterParityObservations.js';

export class FilterParityOrdinaryCommandFilter implements CommandPipelineFilter {
    onExecution(context: CommandContext): void {
        const value = (context.command as { value?: unknown }).value;
        if (typeof value === 'string' && /^(deny|allow)/.test(value)) recordFilterParity('command ordinary', value);
    }
}

export class FilterParityOrdinaryQueryFilter implements QueryPipelineFilter {
    onPerform(context: QueryContext): void {
        const value = (context.query as { value?: unknown }).value;
        if (typeof value === 'string' && /^(deny|allow)/.test(value)) recordFilterParity('query ordinary', value);
    }
}

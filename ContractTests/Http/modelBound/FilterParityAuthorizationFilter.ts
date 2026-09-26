// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { authorizationCommandFilter, unauthorizedCommandResult,
    type AuthorizationCommandFilter, type CommandContext, type CommandResult } from '@cratis/arc.core';
import { FilterParityCommand } from './FilterParityCommand.js';
import { recordFilterParity } from './FilterParityObservations.js';

/** Deny selected commands before validation without affecting other fixtures. */
@authorizationCommandFilter()
export class FilterParityAuthorizationFilter implements AuthorizationCommandFilter {
    onExecution(context: CommandContext): CommandResult | void {
        const value = context.command instanceof FilterParityCommand ? context.command.value :
            typeof context.command === 'object' && context.command !== null && 'value' in context.command
                ? context.command.value : undefined;
        if (typeof value === 'string' && /^(deny|allow)/.test(value)) recordFilterParity('command authorization', value);
        if (typeof value === 'string' && value.startsWith('deny') ||
            Array.isArray(value) && value[0] === 'deny')
            return unauthorizedCommandResult(context, 'Fixture filter denied');
    }
}

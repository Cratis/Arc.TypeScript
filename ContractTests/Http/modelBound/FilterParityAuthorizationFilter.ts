// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { authorizationCommandFilter, unauthorizedCommandResult,
    type AuthorizationCommandFilter, type CommandContext, type CommandResult } from '@cratis/arc.core';
import { FilterParityCommand } from './FilterParityCommand.js';

/** Deny selected commands before validation without affecting other fixtures. */
@authorizationCommandFilter()
export class FilterParityAuthorizationFilter implements AuthorizationCommandFilter {
    onExecution(context: CommandContext): CommandResult | void {
        if (context.command instanceof FilterParityCommand && context.command.value.startsWith('deny'))
            return unauthorizedCommandResult(context, 'Fixture filter denied');
    }
}

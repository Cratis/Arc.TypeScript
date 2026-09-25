// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcApplication } from '../../ArcApplication.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import { commandResult } from '../../commands/createCommandResult.js';
import { unauthorizedCommandResult } from '../../commands/unauthorizedCommandResult.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { authorizationCommandFilter } from '../../commands/authorizationCommandFilterDecorator.js';
import { commandPipelineFilter } from '../../commands/commandPipelineFilterDecorator.js';
import { validation } from '../../validation/ValidationResult.js';

/** A reusable command world with distinguishable filter, validator, and handler effects. */
export class command_filter_fixture {
    readonly calls: string[] = [];
    readonly authorization: new () => { onExecution(context: CommandContext): CommandResult | void };
    readonly pipeline: new () => { onExecution(context: CommandContext): CommandResult };
    constructor() {
        const calls = this.calls;
        @authorizationCommandFilter()
        class Authorization {
            onExecution(context: CommandContext): CommandResult | void {
                calls.push('authorization');
                if ((context.command as { value: string }).value === 'denied' ||
                    (context.command as { value: string }).value === 'invalid')
                    return unauthorizedCommandResult(context, 'Denied by fixture');
            }
        }
        @commandPipelineFilter()
        class Pipeline {
            onExecution(context: CommandContext): CommandResult {
                calls.push('pipeline');
                return commandResult(context);
            }
        }
        this.authorization = Authorization;
        this.pipeline = Pipeline;
    }
    get builder(): ReturnType<typeof ArcApplication.createBuilder> { return ArcApplication.createBuilder({ commands: [defineCommand({
        name: 'Filtered', schema: z.object({ value: z.string() }), authorization: { anonymous: true },
        validate: ({ value }) => {
            this.calls.push('validate');
            return value === 'invalid' ? [validation('Invalid value', ['value'])] : [];
        },
        filters: [() => { this.calls.push('local'); return [validation('Local result')]; }],
        provide: () => { this.calls.push('provide'); },
        handle: () => { this.calls.push('handle'); return 'handled'; }
    })] }); }
    readonly execution = { correlationId: 'filter-request', principal: undefined, tenantId: undefined,
        signal: new AbortController().signal, allowedSeverity: 2 };
}

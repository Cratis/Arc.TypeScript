// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { given } from '../../given.js';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { tuple } from '../../commands/tuple.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import type { CommandResponseValueHandler } from '../../commands/CommandResponseValueHandler.js';
should();
class a_command_with_scoped_handlers {
    readonly calls: string[] = [];
    readonly server: ArcServer;
    constructor() {
        const first = serviceToken<CommandResponseValueHandler>('first');
        const second = serviceToken<CommandResponseValueHandler>('second');
        const values = serviceToken<{ provide(command: unknown): Record<string, unknown> }>('values');
        const keys = serviceToken<{ resolve(command: unknown): string | undefined }>('keys');
        this.server = new ArcServer({
            services: [
                { token: first, lifetime: 'scoped', factory: () => ({
                    canHandle: (_context: CommandContext, value: unknown) => value === 'effect',
                    handle: (context: CommandContext) => { this.calls.push(`first ${context.key} ${context.values.get('COUNT')}`); }
                }) },
                { token: second, lifetime: 'scoped', factory: () => ({
                    canHandle: (_context: CommandContext, value: unknown) => value === 'effect',
                    handle: () => { this.calls.push('second'); }
                }) },
                { token: values, lifetime: 'scoped', factory: () => ({ provide: () => ({ count: 1, COUNT: 2 }) }) },
                { token: keys, lifetime: 'scoped', factory: () => ({ resolve: () => 'key-7' }) }
            ],
            commandContextValuesProviders: [values], commandKeyResolvers: [keys],
            commandResponseValueHandlers: [first, second],
            commands: [defineCommand({ name: 'Run', schema: z.object({}), handle: () => tuple('reply', 'effect') })]
        });
    }
}
describe('when processing a command response with scoped handlers', given(a_command_with_scoped_handlers, context => {
    let result: CommandResult;
    beforeEach(async () => {
        result = await context.server.executeCommand('Run', {}, { correlationId: 'response', allowedSeverity: 2,
            principal: undefined, tenantId: 'tenant', signal: new AbortController().signal });
    });
    it('should run every matching handler and expose merged values and the command key', () => {
        context.calls.should.deep.equal(['first key-7 2', 'second']);
        (result.response as string).should.equal('reply');
    });
}));

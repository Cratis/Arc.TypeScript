// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import { unauthorizedCommandResult } from '../../commands/unauthorizedCommandResult.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
should();

describe('when authorizing with prepared command context values', () => {
    let server: ArcServer;
    let allowed: boolean;
    let denied: boolean;
    let malformed: boolean;
    let providerCalls: number;
    let resolverCalls: number;
    beforeEach(async () => {
        providerCalls = 0;
        resolverCalls = 0;
        class Values { provide() { providerCalls++; return { access: 'editor' }; } }
        class Key { resolve(command: { id: string }) { resolverCalls++; return command.id; } }
        class Gate { onExecution(context: CommandContext) {
            if (context.key !== 'own' || context.values.get('access') !== 'editor')
                return unauthorizedCommandResult(context);
        } }
        server = new ArcServer({
            services: [Values, Key, Gate].map(token => ({ token, lifetime: ServiceLifetime.Scoped, factory: () => new token() })),
            commandContextValuesProviders: [Values], commandKeyResolvers: [Key], authorizationCommandFilters: [Gate],
            commands: [defineCommand({ name: 'Update', schema: z.object({ id: z.string() }), handle: () => 'done' })]
        });
        allowed = (await server.executeCommand('Update', { id: 'own' }, { correlationId: 'values', allowedSeverity: 2,
            principal: undefined, tenantId: undefined, signal: new AbortController().signal })).isSuccess;
        denied = (await server.executeCommand('Update', { id: 'other' }, { correlationId: 'values', allowedSeverity: 2,
            principal: undefined, tenantId: undefined, signal: new AbortController().signal })).isAuthorized;
        malformed = !(await server.executeCommand('Update', { id: 2 }, { correlationId: 'values', allowedSeverity: 2,
            principal: undefined, tenantId: undefined, signal: new AbortController().signal })).isAuthorized;
    });
    afterEach(async () => { await server.dispose(); });
    it('should allow the resolved key and value', () => { allowed.should.equal(true); });
    it('should deny a different key', () => { denied.should.equal(false); });
    it('should not invoke context preparation for malformed input', () => {
        malformed.should.equal(true);
        providerCalls.should.equal(2);
        resolverCalls.should.equal(2);
    });
});

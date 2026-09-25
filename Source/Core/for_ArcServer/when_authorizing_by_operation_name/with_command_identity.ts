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

const execution = { correlationId: 'identity', allowedSeverity: 2, principal: undefined, tenantId: undefined,
    signal: new AbortController().signal };

describe('when authorizing identical commands by declared operation name', () => {
    let server: ArcServer;
    let names: (string | undefined)[];
    let allowed: boolean;
    let denied: boolean;
    let malformed: boolean;
    let validated: boolean;
    let spoofed: boolean;
    let immutable: boolean;
    beforeEach(async () => {
        names = [];
        class Gate {
            onExecution(context: CommandContext) {
                names.push(context.operationName);
                if (context.operationName === 'Tasks.Denied') {
                    immutable = Reflect.set(context, 'operationName', 'Tasks.Allowed') === false;
                    try { Object.defineProperty(context, 'operationName', { value: 'Tasks.Allowed' }); immutable = false; }
                    catch { /* The identity is not configurable. */ }
                }
                if (context.operationName !== 'Tasks.Allowed') return unauthorizedCommandResult(context);
            }
        }
        server = new ArcServer({
            services: [{ token: Gate, lifetime: ServiceLifetime.Scoped, factory: () => new Gate() }],
            authorizationCommandFilters: [Gate],
            commands: [
                defineCommand({ name: 'Allowed', namespace: 'Tasks', schema: z.object({}), handle: () => 'yes' }),
                defineCommand({ name: 'Denied', namespace: 'Tasks', schema: z.object({}), handle: () => 'no' })
            ]
        });
        allowed = (await server.executeCommand('Tasks.Allowed', {}, execution)).isSuccess;
        denied = (await server.executeCommand('Tasks.Denied', {}, execution)).isAuthorized;
        malformed = (await server.executeCommand('Tasks.Allowed', 'invalid', execution)).validationResults.length > 0;
        validated = (await server.validateCommand('Tasks.Denied', {}, execution)).isAuthorized;
        const spoofedExecution = { ...execution, operationName: 'Tasks.Allowed' };
        spoofed = (await server.executeCommand('Tasks.Denied', { operationName: 'Tasks.Allowed' },
            spoofedExecution)).isAuthorized;
    });
    afterEach(async () => { await server.dispose(); });
    it('should admit only the named operation', () => { allowed.should.equal(true); denied.should.equal(false); });
    it('should identify each command the same way as introspection', () => {
        names.should.deep.equal(['Tasks.Allowed', 'Tasks.Denied', 'Tasks.Allowed', 'Tasks.Denied', 'Tasks.Denied']);
        server.commands.map(item => item.fullyQualifiedName).should.deep.equal(['Tasks.Allowed', 'Tasks.Denied']);
    });
    it('should preserve the name with malformed input and validation only', () => {
        malformed.should.equal(true);
        validated.should.equal(false);
    });
    it('should not allow caller input or execution context to spoof identity', () => {
        spoofed.should.equal(false);
        immutable.should.equal(true);
    });
});

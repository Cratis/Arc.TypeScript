// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { defineCommand } from '../../../commands/defineCommand.js';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { currentServices } from '../../ServiceScope.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, serviceContext } from '../../for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when disposing a scope with an unrelated manual scope and nested command', () => {
    let success: boolean;
    let response: unknown;
    let auditSuccess: boolean;
    let effects: number;
    let events: string[];
    beforeEach(async () => {
        const token = serviceToken<object>('outer resource'); const resource = serviceToken<object>('other resource');
        effects = 0; events = [];
        const registry = new ServiceRegistry([
            { token: resource, lifetime: ServiceLifetime.Scoped, factory: () => ({ [Symbol.dispose]: () => { events.push('other'); } }) },
            { token, lifetime: ServiceLifetime.Scoped, factory: () => ({ [Symbol.asyncDispose]: async () => {
                const manual = registry.createScope(serviceContext('other'));
                await manual.resolve(resource);
                await manual.dispose();
                const result = await server.executeCommand('Audit', {}, serviceContext('audit'));
                auditSuccess = result.isSuccess;
                events.push('outer');
            } }) }
        ]);
        const server = new ArcServer({ services: registry, commands: [
            defineCommand({ name: 'Audit', schema: z.object({}), handle: () => { effects++; return 'audited'; } }),
            defineCommand({ name: 'Work', schema: z.object({}), handle: async () => {
                await currentServices().resolve(token);
                return 'committed';
            } })
        ] });
        try {
            const result = await beforeDeadline(server.executeCommand('Work', {}, serviceContext('work')), 'nested audit in disposer');
            success = result.isSuccess; response = result.response;
        } finally { await registry.dispose(); }
    });
    it('should commit the outer command and nested audit', () => {
        success.should.equal(true);
        (response as string).should.equal('committed');
        auditSuccess.should.equal(true);
        effects.should.equal(1);
    });
    it('should dispose the unrelated scope before the outer scope', () => events.should.deep.equal(['other', 'outer']));
});

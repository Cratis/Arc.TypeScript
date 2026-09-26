// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { defineQuery } from '../../queries/defineQuery.js';
import type { AuthorizationPolicy } from '../../authorization/AuthorizationPolicy.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
should();
function deferred() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}
const authorization = { requirements: [{ policy: 'First' }, { policy: 'Second' }] };

describe('when canceling declared authorization', () => {
    for (const kind of ['command', 'query'] as const) {
        it(`should not resolve or invoke a policy for a pre-aborted direct ${kind}`, async () => {
            const controller = new AbortController();
            controller.abort(new Error('canceled'));
            const calls: string[] = [];
            class First implements AuthorizationPolicy {
                authorize() { calls.push('invoke first'); return true; }
            }
            class Second implements AuthorizationPolicy {
                authorize() { calls.push('invoke second'); return true; }
            }
            const server = new ArcServer({ services: [
                { token: First, lifetime: ServiceLifetime.Scoped, factory: () => { calls.push('resolve first'); return new First(); } },
                { token: Second, lifetime: ServiceLifetime.Scoped, factory: () => { calls.push('resolve second'); return new Second(); } }
            ], authorizationPolicies: { First, Second },
            commands: [defineCommand({ name: 'Run', schema: z.object({}), authorization, handle: () => 'done' })],
            queries: [defineQuery({ name: 'Read', schema: z.object({}), authorization, perform: () => 'done' })] });
            try {
                const execution = { correlationId: kind, allowedSeverity: 2, principal: { id: 'alice', roles: [], isAuthenticated: true },
                    tenantId: undefined, signal: controller.signal };
                const result = kind === 'command' ? await server.executeCommand('Run', {}, execution) :
                    await server.performQuery('Read', {}, execution);
                calls.should.deep.equal([]);
                result.isSuccess.should.equal(false);
                result.exceptionMessages.should.deep.equal(['Error: canceled']);
            } finally { await server.dispose(); }
        });
        it(`should not start a second policy after cancellation during the first for a ${kind}`, async () => {
            const controller = new AbortController();
            const started = deferred();
            const release = deferred();
            const calls: string[] = [];
            class First implements AuthorizationPolicy {
                async authorize() { calls.push('invoke first'); started.release(); await release.promise; return true; }
            }
            class Second implements AuthorizationPolicy {
                authorize() { calls.push('invoke second'); return true; }
            }
            const server = new ArcServer({ services: [
                { token: First, lifetime: ServiceLifetime.Scoped, factory: () => { calls.push('resolve first'); return new First(); } },
                { token: Second, lifetime: ServiceLifetime.Scoped, factory: () => { calls.push('resolve second'); return new Second(); } }
            ], authorizationPolicies: { First, Second },
            commands: [defineCommand({ name: 'Run', schema: z.object({}), authorization, handle: () => 'done' })],
            queries: [defineQuery({ name: 'Read', schema: z.object({}), authorization, perform: () => 'done' })] });
            try {
                const execution = { correlationId: kind, allowedSeverity: 2, principal: { id: 'alice', roles: [], isAuthenticated: true },
                    tenantId: undefined, signal: controller.signal };
                const pending = kind === 'command' ? server.executeCommand('Run', {}, execution) : server.performQuery('Read', {}, execution);
                await started.promise;
                controller.abort(new Error('canceled'));
                release.release();
                const result = await pending;
                calls.should.deep.equal(['resolve first', 'invoke first']);
                result.isSuccess.should.equal(false);
                result.exceptionMessages.should.deep.equal(['Error: canceled']);
            } finally { await server.dispose(); }
        });
    }
    it('should not invoke a resolved policy or resolve the next one after cancellation during service resolution', async () => {
        const controller = new AbortController();
        const started = deferred();
        const release = deferred();
        const calls: string[] = [];
        class First implements AuthorizationPolicy {
            authorize() { calls.push('invoke first'); return true; }
        }
        class Second implements AuthorizationPolicy {
            authorize() { calls.push('invoke second'); return true; }
        }
        const server = new ArcServer({ services: [
            { token: First, lifetime: ServiceLifetime.Scoped, factory: async () => {
                calls.push('resolve first'); started.release(); await release.promise; return new First();
            } },
            { token: Second, lifetime: ServiceLifetime.Scoped, factory: () => { calls.push('resolve second'); return new Second(); } }
        ], authorizationPolicies: { First, Second }, queries: [defineQuery({ name: 'Read', schema: z.object({}),
            authorization, perform: () => 'done' })] });
        try {
            const pending = server.performQuery('Read', {}, { correlationId: 'cancel-policy-resolve', allowedSeverity: 2,
                principal: { id: 'alice', roles: [], isAuthenticated: true }, tenantId: undefined, signal: controller.signal });
            await started.promise;
            controller.abort(new Error('canceled'));
            release.release();
            const result = await pending;
            calls.should.deep.equal(['resolve first']);
            result.isSuccess.should.equal(false);
        } finally { await server.dispose(); }
    });
});

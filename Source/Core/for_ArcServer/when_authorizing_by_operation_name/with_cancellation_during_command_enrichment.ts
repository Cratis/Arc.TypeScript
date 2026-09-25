// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
should();

function deferred<T>() {
    let release!: (value: T) => void;
    const promise = new Promise<T>(resolve => { release = resolve; });
    return { promise, release };
}

for (const stage of ['values factory', 'values provider'] as const) describe(`when cancellation occurs during ${stage}`, () => {
    let server: ArcServer;
    let result: CommandResult;
    let calls: string[];
    beforeEach(async () => {
        calls = [];
        const controller = new AbortController();
        const pending = deferred<void>();
        const started = deferred<void>();
        class Values { async provide() {
            calls.push('values');
            if (stage === 'values provider') { started.release(); await pending.promise; }
            return { access: 'editor' };
        } }
        class Key { resolve() { calls.push('key'); return 'own'; } }
        class Gate { onExecution() { calls.push('authorization filter'); } }
        server = new ArcServer({
            services: [{ token: Values, lifetime: ServiceLifetime.Scoped, factory: async () => {
                calls.push('values factory');
                if (stage === 'values factory') { started.release(); await pending.promise; }
                return new Values();
            } }, ...[Key, Gate].map(token => ({ token, lifetime: ServiceLifetime.Scoped, factory: () => new token() }))],
            commandContextValuesProviders: [Values], commandKeyResolvers: [Key], authorizationCommandFilters: [Gate],
            commands: [defineCommand({ name: 'Update', schema: z.object({ id: z.string() }),
                handle: () => { calls.push('handle'); } })]
        });
        const running = server.executeCommand('Update', { id: 'own' }, {
            correlationId: 'cancel-enrichment', allowedSeverity: 2, principal: undefined, tenantId: undefined,
            signal: controller.signal
        });
        await started.promise;
        controller.abort(new Error('canceled'));
        pending.release();
        result = await running;
    });
    afterEach(async () => { await server.dispose(); });
    it('should return cancellation rather than authorization success', () => {
        result.isSuccess.should.equal(false);
        result.hasExceptions.should.equal(true);
    });
    it('should not start a later provider, authorization filter or handler', () => {
        calls.should.not.contain('key');
        if (stage === 'values factory') calls.should.not.contain('values');
        calls.should.not.contain('authorization filter');
        calls.should.not.contain('handle');
    });
});

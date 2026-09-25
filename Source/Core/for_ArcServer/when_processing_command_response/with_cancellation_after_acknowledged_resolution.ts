// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { acknowledgeCommandCommit } from '../../commands/acknowledgeCommandCommit.js';
import { defineCommand } from '../../commands/defineCommand.js';
import type { CommandResponseValueHandler } from '../../commands/CommandResponseValueHandler.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
should();
function deferred() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}

describe('when cancellation occurs during response service resolution after an acknowledged commit', () => {
    it('should fail without resolving the next service or claiming the commit was undone', async () => {
        const controller = new AbortController();
        const started = deferred();
        const release = deferred();
        const calls: string[] = [];
        const first = serviceToken<CommandResponseValueHandler>('A first');
        const second = serviceToken<CommandResponseValueHandler>('B second');
        const server = new ArcServer({ services: [
            { token: first, lifetime: ServiceLifetime.Scoped, factory: async () => {
                calls.push('resolve A'); started.release(); await release.promise;
                return { canHandle: () => true, handle: () => { calls.push('handle A'); } };
            } },
            { token: second, lifetime: ServiceLifetime.Scoped, factory: () => {
                calls.push('resolve B'); return { canHandle: () => true, handle: () => { calls.push('handle B'); } };
            } }
        ], commandResponseValueHandlers: [first, second], commands: [defineCommand({ name: 'Run', schema: z.object({}),
            handle: (_value, context) => { acknowledgeCommandCommit(context); return 'effect'; } })] });
        try {
            const pending = server.executeCommand('Run', {}, { correlationId: 'cancel-resolve-ack', allowedSeverity: 2,
                principal: undefined, tenantId: undefined, signal: controller.signal });
            await started.promise;
            controller.abort(new Error('canceled'));
            release.release();
            const result = await pending;
            calls.should.deep.equal(['resolve A']);
            result.isSuccess.should.equal(false);
            result.exceptionMessages.should.deep.equal(['Error: canceled']);
            (result.response === undefined).should.equal(true);
        } finally { await server.dispose(); }
    });
});

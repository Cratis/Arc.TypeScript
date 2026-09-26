// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
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

describe('when cancellation prevents invocation for a classified response value', () => {
    it('should fail without returning the handled value as a client response', async () => {
        const controller = new AbortController();
        const started = deferred();
        const release = deferred();
        let invoked = false;
        const token = serviceToken<CommandResponseValueHandler>('handler');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped, factory: () => ({
            canHandle: async () => { started.release(); await release.promise; return true; },
            handle: () => { invoked = true; }
        }) }], commandResponseValueHandlers: [token], commands: [defineCommand({ name: 'Run', schema: z.object({}),
            handle: () => 'effect' })] });
        try {
            const pending = server.executeCommand('Run', {}, { correlationId: 'cancel-classify', allowedSeverity: 2,
                principal: undefined, tenantId: undefined, signal: controller.signal });
            await started.promise;
            controller.abort(new Error('canceled'));
            release.release();
            const result = await pending;
            invoked.should.equal(false);
            result.isSuccess.should.equal(false);
            (result.response === undefined).should.equal(true);
            result.exceptionMessages.should.deep.equal(['Error: canceled']);
        } finally { await server.dispose(); }
    });
});

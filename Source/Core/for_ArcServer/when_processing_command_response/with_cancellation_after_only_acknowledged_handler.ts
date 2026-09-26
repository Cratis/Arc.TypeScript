// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { acknowledgeCommandCommit } from '../../commands/acknowledgeCommandCommit.js';
import { defineCommand } from '../../commands/defineCommand.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import { tuple } from '../../commands/tuple.js';
import type { CommandResponseValueHandler } from '../../commands/CommandResponseValueHandler.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
should();
function deferred() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}

describe('when cancellation follows the only acknowledged response handler', () => {
    it('should keep its success and client response', async () => {
        const controller = new AbortController();
        const started = deferred();
        const release = deferred();
        const token = serviceToken<CommandResponseValueHandler>('handler');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped, factory: () => ({
            canHandle: (_context: unknown, value: unknown) => value === 'effect',
            handle: async (context: CommandContext) => { acknowledgeCommandCommit(context); started.release(); await release.promise; }
        }) }], commandResponseValueHandlers: [token], commands: [defineCommand({ name: 'Run', schema: z.object({}),
            handle: () => tuple('done', 'effect') })] });
        try {
            const pending = server.executeCommand('Run', {}, { correlationId: 'cancel-only', allowedSeverity: 2,
                principal: undefined, tenantId: undefined, signal: controller.signal });
            await started.promise;
            controller.abort(new Error('canceled'));
            release.release();
            const result = await pending;
            result.isSuccess.should.equal(true);
            result.response!.should.equal('done');
        } finally { await server.dispose(); }
    });
});

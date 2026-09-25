// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { acknowledgeCommandCommit } from '../../commands/acknowledgeCommandCommit.js';
import { defineCommand } from '../../commands/defineCommand.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import type { CommandResponseValueHandler } from '../../commands/CommandResponseValueHandler.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import { tuple } from '../../commands/tuple.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
should();
function deferred() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}

describe('when canceling after a response handler acknowledges an inline append', () => {
    let calls: string[];
    let result: CommandResult;
    beforeEach(async () => {
        calls = [];
        const controller = new AbortController();
        const started = deferred();
        const release = deferred();
        const first = serviceToken<CommandResponseValueHandler>('A first');
        const second = serviceToken<CommandResponseValueHandler>('B second');
        const server = new ArcServer({ services: [
            { token: first, lifetime: ServiceLifetime.Scoped, factory: () => ({
                canHandle: (_context: unknown, value: unknown) => value === 'effect',
                handle: async (context: CommandContext) => { calls.push('append'); acknowledgeCommandCommit(context); started.release(); await release.promise; }
            }) },
            { token: second, lifetime: ServiceLifetime.Scoped, factory: () => ({
                canHandle: (_context: unknown, value: unknown) => value === 'effect',
                handle: () => { calls.push('second'); }
            }) }
        ], commandResponseValueHandlers: [first, second], commands: [defineCommand({
            name: 'Run', schema: z.object({}), handle: () => tuple('done', 'effect')
        })] });
        try {
            const pending = server.executeCommand('Run', {}, { correlationId: 'cancel-after-append', allowedSeverity: 2,
                principal: undefined, tenantId: undefined, signal: controller.signal });
            await started.promise;
            controller.abort(new Error('canceled'));
            release.release();
            result = await pending;
        } finally { await server.dispose(); }
    });
    it('should fail because the later handler did not run without claiming the append was undone', () => {
        calls.should.deep.equal(['append']);
        result.isSuccess.should.equal(false);
        (result.response === undefined).should.equal(true);
        result.exceptionMessages.should.deep.equal(['Error: canceled']);
    });
});

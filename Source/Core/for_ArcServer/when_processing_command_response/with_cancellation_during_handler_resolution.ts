// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import type { CommandResponseValueHandler } from '../../commands/CommandResponseValueHandler.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
should();
function deferred() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}

describe('when canceling while a response handler service is resolving', () => {
    let calls: string[];
    let result: CommandResult;
    beforeEach(async () => {
        calls = [];
        const controller = new AbortController();
        const started = deferred();
        const release = deferred();
        const token = serviceToken<CommandResponseValueHandler>('handler');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped, factory: async () => {
            started.release();
            await release.promise;
            return { canHandle: () => true, handle: () => { calls.push('handle'); },
                [Symbol.dispose]: () => { calls.push('dispose'); } };
        } }], commandResponseValueHandlers: [token], commands: [defineCommand({
            name: 'Run', schema: z.object({}), handle: () => 'effect',
            scopes: [() => ({ begin: () => { calls.push('begin'); },
                complete: () => { calls.push('complete'); } })]
        })] });
        const pending = server.executeCommand('Run', {}, { correlationId: 'cancel-resolution', allowedSeverity: 2,
            principal: undefined, tenantId: undefined, signal: controller.signal });
        await started.promise;
        controller.abort(new Error('canceled'));
        release.release();
        result = await pending;
        await server.dispose();
    });
    it('should not invoke the resolved handler', () => { calls.should.not.include('handle'); });
    it('should fail while completing the scope and disposing owned services', () => {
        result.isSuccess.should.equal(false);
        calls.should.deep.equal(['begin', 'complete', 'dispose']);
    });
});

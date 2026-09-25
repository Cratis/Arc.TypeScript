// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { CommandCommitDisposition } from '../../commands/CommandCommitDisposition.js';
import { CommandRecoveryStatus } from '../../commands/CommandRecoveryStatus.js';
import type { CommandResponseValueHandler } from '../../commands/CommandResponseValueHandler.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import { tuple } from '../../commands/tuple.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { ProbeOperation } from '../given/an_operation_command.js';
should();
function deferred() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}

describe('when canceling during the first response handler with a prepared operation', () => {
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
                handle: async () => { calls.push('first'); started.release(); await release.promise; },
                [Symbol.dispose]: () => { calls.push('dispose first'); }
            }) },
            { token: second, lifetime: ServiceLifetime.Scoped, factory: () => ({
                canHandle: (_context: unknown, value: unknown) => value === 'effect',
                handle: () => { calls.push('second'); },
                [Symbol.dispose]: () => { calls.push('dispose second'); }
            }) }
        ], commandResponseValueHandlers: [first, second], commands: [defineCommand({
            name: 'Run', schema: z.object({}), handle: () => tuple('effect', new ProbeOperation('operation', calls)),
            scopes: [() => ({ isCommitParticipant: true, getCommitDisposition: () => CommandCommitDisposition.NoCommit,
                begin: () => { calls.push('begin'); }, complete: () => { calls.push('complete'); } })]
        })] });
        const pending = server.executeCommand('Run', {}, { correlationId: 'cancel-first', allowedSeverity: 2,
            principal: undefined, tenantId: undefined, signal: controller.signal });
        await started.promise;
        controller.abort(new Error('canceled'));
        release.release();
        result = await pending;
        await server.dispose();
    });
    it('should not start later response or operation effects', () => {
        calls.should.not.include('second');
        calls.should.not.include('execute operation');
    });
    it('should fail and complete the scope and owned services', () => {
        result.isSuccess.should.be.false;
        calls.should.include('complete');
        calls.should.include('dispose first');
        calls.should.include('dispose second');
    });
    it('should retain the prepared recovery journal', () => {
        result.recovery!.status.should.equal(CommandRecoveryStatus.NotNeeded);
        result.operationOutcomes!.should.be.empty;
    });
});

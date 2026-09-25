// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandCommitDisposition } from '../../commands/CommandCommitDisposition.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { CommandOperation } from '../../commands/CommandOperation.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
class Effect extends CommandOperation { execute(signal: AbortSignal): void { void signal; } }
const execution = { correlationId: 'configuration', allowedSeverity: 2, principal: undefined, tenantId: undefined,
    signal: new AbortController().signal };
describe('when two scopes participate in a deferred commit', () => {
    let result: CommandResult;
    let calls: number;
    beforeEach(async () => {
        calls = 0;
        const participant = () => ({ isCommitParticipant: true as const,
            getCommitDisposition: () => CommandCommitDisposition.NoCommit as const,
            begin: () => {}, complete: () => {} });
        const server = new ArcServer({ commands: [defineCommand({ name: 'Run', schema: z.object({}),
            scopes: [participant, participant], handle: () => {
                calls++;
                return new Effect();
            } })] });
        result = await server.executeCommand('Run', {}, execution);
    });
    it('should reject the batch before execution', () => {
        result.isSuccess.should.equal(false);
        calls.should.equal(1);
        result.operationOutcomes!.should.have.lengthOf(0);
    });
});
describe('when configuring an invalid compensation timeout', () => {
    let error: unknown;
    beforeEach(() => {
        try { new ArcServer({ commandCompensationTimeoutMs: 0 }); }
        catch (caught) { error = caught; }
    });
    it('should reject it at construction', () => {
        (error as Error).message.should.contain('Compensation timeout');
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { CommandOperation } from '../../commands/CommandOperation.js';
import type { CommandOperationFailure } from '../../commands/CommandOperationFailure.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
describe('when an operation triggers request cancellation', () => {
    let result: CommandResult;
    let source: string | undefined;
    beforeEach(async () => {
        const controller = new AbortController();
        class Cancel extends CommandOperation {
            execute(signal: AbortSignal): void { void signal; controller.abort(new Error('canceled')); }
            compensate(failure: CommandOperationFailure, signal: AbortSignal): void { void signal; source = failure.source; }
        }
        const server = new ArcServer({ commands: [defineCommand({ name: 'Run', schema: z.object({}), handle: () => new Cancel() })] });
        result = await server.executeCommand('Run', {}, { correlationId: 'cancel', allowedSeverity: 2,
            principal: undefined, tenantId: undefined, signal: controller.signal });
    });
    it('should identify cancellation to the compensator', () => {
        result.isSuccess.should.equal(false);
        source!.should.equal('cancellation');
    });
});
describe('when a compensator finishes after the shared budget expires', () => {
    let result: CommandResult;
    beforeEach(async () => {
        class Slow extends CommandOperation {
            execute(signal: AbortSignal): void { void signal; throw new Error('execute failed'); }
            async compensate(failure: CommandOperationFailure, signal: AbortSignal): Promise<void> {
                void failure; void signal;
                await new Promise(resolve => setTimeout(resolve, 20));
            }
        }
        const server = new ArcServer({ commandCompensationTimeoutMs: 1,
            commands: [defineCommand({ name: 'Run', schema: z.object({}), handle: () => new Slow() })] });
        result = await server.executeCommand('Run', {}, { correlationId: 'budget', allowedSeverity: 2,
            principal: undefined, tenantId: undefined, signal: new AbortController().signal });
    });
    it('should report the finished callback as budget expired', () => {
        result.recovery!.status.should.equal('Incomplete');
        result.operationOutcomes![0]!.compensation.should.equal('BudgetExpired');
    });
});

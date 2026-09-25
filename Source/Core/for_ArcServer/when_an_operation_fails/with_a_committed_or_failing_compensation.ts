// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandCommitDisposition } from '../../commands/CommandCommitDisposition.js';
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { an_operation_command, ProbeOperation } from '../given/an_operation_command.js';
import { CommandOperation } from '../../commands/CommandOperation.js';
import { tuple } from '../../commands/tuple.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
describe('when a scope commits before recovery', given(an_operation_command, context => {
    let result: CommandResult;
    beforeEach(async () => {
        context.afterCompletion = CommandCommitDisposition.Committed;
        context.twoOperations();
        result = await context.server.executeCommand('Run', context.command, context.context);
    });
    it('should suppress compensation', () => {
        result.recovery!.status.should.equal('Suppressed');
        result.operationOutcomes!.map(outcome => outcome.compensation).should.deep.equal(['Suppressed', 'Suppressed']);
        context.events.should.deep.equal(['begin', 'execute first', 'execute second', 'complete']);
    });
}));
describe('when one compensator throws', given(an_operation_command, context => {
    let result: CommandResult;
    beforeEach(async () => {
        class FailingCompensation extends CommandOperation {
            execute(signal: AbortSignal): void { void signal; context.events.push('execute middle'); }
            compensate(failure: unknown, signal: AbortSignal): void { void failure; void signal; context.events.push('compensate middle'); throw new Error('compensation failed'); }
        }
        context.value = tuple(new ProbeOperation('first', context.events), new FailingCompensation(),
            new ProbeOperation('last', context.events, true));
        result = await context.server.executeCommand('Run', context.command, context.context);
    });
    it('should report failure and continue with earlier compensators', () => {
        result.isSuccess.should.equal(false);
        result.recovery!.failedCompensationCount.should.equal(1);
        context.events.should.deep.equal(['begin', 'execute first', 'execute middle', 'execute last', 'complete',
            'compensate last', 'compensate middle', 'compensate first']);
    });
}));

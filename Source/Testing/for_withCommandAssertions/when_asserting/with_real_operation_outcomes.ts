// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandCommitDisposition } from '@cratis/arc.core';
import { tuple } from '@cratis/arc.core';
import { an_operation_command, ProbeOperation } from '../../../Core/for_ArcServer/given/an_operation_command.js';
import { withCommandAssertions } from '../../withCommandAssertions.js';

describe('when asserting real command operation outcomes', () => {
    let context: an_operation_command;
    beforeEach(() => { context = new an_operation_command(); });
    afterEach(async () => { await context.server.dispose(); });
    it('should distinguish completed execution from partial invocations and completed compensation', async () => {
        context.twoOperations();
        const result = withCommandAssertions(await context.server.executeCommand('Run', context.command, context.context));
        result.shouldHaveExecutedOperation(ProbeOperation).shouldHaveCompensatedOperation(ProbeOperation);
        result.operationOutcomes!.map(outcome => outcome.executionCompleted).should.deep.equal([true, false]);
        (() => result.shouldHaveNoOperationInvocations()).should.throw('Expected no operation invocations');
    });
    it('should identify indeterminate recovery without claiming compensation', async () => {
        context.disposition = CommandCommitDisposition.NoCommit;
        context.afterCompletion = CommandCommitDisposition.Unknown;
        context.value = tuple('reply', new ProbeOperation('first', context.events));
        const result = withCommandAssertions(await context.server.executeCommand('Run', context.command, context.context));
        result.shouldHaveExecutedOperation(ProbeOperation).shouldHaveIndeterminateRecovery();
        (() => result.shouldHaveCompensatedOperation(ProbeOperation)).should.throw('Expected a completed Compensate');
    });
    it('should accept no invocations on a command with no operations', async () => {
        context.value = 'reply';
        const result = withCommandAssertions(await context.server.executeCommand('Run', context.command, context.context));
        result.shouldHaveNoOperationInvocations();
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { an_operation_command } from '../given/an_operation_command.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
describe('when an operation fails with no commit', given(an_operation_command, context => {
    let result: CommandResult;
    beforeEach(async () => {
        context.twoOperations();
        result = await context.server.executeCommand('Run', context.command, context.context);
    });
    it('should reverse every entered operation and complete the scope', () => {
        context.events.should.deep.equal(['begin', 'execute first', 'execute second', 'complete', 'compensate second', 'compensate first']);
    });
    it('should report failure and keep recovery out of the wire result', () => {
        result.isSuccess.should.equal(false);
        (result.response === undefined).should.equal(true);
        result.recovery!.status.should.equal('Completed');
        result.recovery!.startedCount.should.equal(2);
        JSON.stringify(result).should.not.contain('recovery');
        JSON.stringify(result).should.not.contain('operationOutcomes');
    });
}));

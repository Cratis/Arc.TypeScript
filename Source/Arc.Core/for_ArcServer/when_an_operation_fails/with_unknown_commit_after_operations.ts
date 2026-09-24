// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { an_operation_command } from '../given/an_operation_command.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
describe('when an operation fails with an unknown commit', given(an_operation_command, context => {
    let result: CommandResult;
    beforeEach(async () => {
        context.disposition = 'NoCommit';
        context.afterCompletion = 'Unknown';
        context.twoOperations();
        result = await context.server.executeCommand('Run', context.command, context.context);
    });
    it('should report an indeterminate recovery when the commit becomes unknown after execution', () => {
        context.events.should.deep.equal(['begin', 'execute first', 'execute second', 'complete']);
        result.recovery!.status.should.equal('Indeterminate');
        result.isSuccess.should.equal(false);
    });
}));

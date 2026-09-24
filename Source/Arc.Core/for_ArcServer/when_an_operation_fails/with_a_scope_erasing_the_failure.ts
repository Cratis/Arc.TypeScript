// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { an_operation_command } from '../given/an_operation_command.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
describe('when an operation fails with a scope erasing the failure', given(an_operation_command, context => {
    let result: CommandResult;
    beforeEach(async () => {
        context.eraseFailure = true;
        context.twoOperations();
        result = await context.server.executeCommand('Run', context.command, context.context);
    });
    it('should preserve the original failure and attempt compensation', () => {
        result.isSuccess.should.equal(false);
        result.exceptionMessages[0]!.should.contain('failed second');
        result.recovery!.status.should.equal('Completed');
    });
}));

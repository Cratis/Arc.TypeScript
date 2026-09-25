// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import { a_command_with_invalid_client_output } from '../given/a_command_with_invalid_client_output.js';
should();
describe('when an operation response fails the client output check', given(a_command_with_invalid_client_output, context => {
    let result: CommandResult;
    beforeEach(async () => {
        result = await context.server.executeCommand('Run', {}, context.context);
    });
    it('should retain the operation journal for recovery', () => {
        result.isSuccess.should.equal(false);
        result.recovery!.status.should.equal('NotNeeded');
        result.recovery!.startedCount.should.equal(0);
        result.operationOutcomes!.should.have.lengthOf(0);
        context.events.should.deep.equal(['begin', 'complete']);
    });
}));

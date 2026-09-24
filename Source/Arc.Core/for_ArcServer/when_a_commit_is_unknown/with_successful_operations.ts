// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { an_operation_command, ProbeOperation } from '../given/an_operation_command.js';
import type { CommandResult } from '../../commands/CommandResult.js';
should();
describe('when a commit is unknown with successful operations', given(an_operation_command, context => {
    let result: CommandResult;
    beforeEach(async () => {
        context.value = new ProbeOperation('first', context.events);
        context.afterCompletion = 'Unknown';
        result = await context.server.executeCommand('Run', context.command, context.context);
    });
    it('should report an indeterminate failure without compensating', () => {
        result.isSuccess.should.equal(false);
        result.recovery!.status.should.equal('Indeterminate');
        context.events.should.deep.equal(['begin', 'execute first', 'complete']);
    });
}));

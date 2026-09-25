// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import sinon from 'sinon';
import { given } from '../../given.js';
import { an_operation_command, ProbeOperation } from '../given/an_operation_command.js';
import { rejected } from '../../commands/Outcome.js';
import { tuple } from '../../commands/tuple.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import { CommandOperationExecution } from '../../commands/CommandOperationExecution.js';
should();
describe('when a rejected operation response precedes a scope completion failure', given(an_operation_command, context => {
    let result: CommandResult;
    let recover: sinon.SinonSpy;
    beforeEach(async () => {
        recover = sinon.spy(CommandOperationExecution.prototype, 'recover');
        context.failCompletion = true;
        context.value = tuple(rejected({ severity: 3, message: 'response rejected', members: [], reason: 'rule' }),
            new ProbeOperation('first', context.events));
        result = await context.server.executeCommand('Run', context.command, context.context);
    });
    afterEach(() => { recover.restore(); });
    it('should retain the response failure before the scope failure', () => {
        result.validationResults[0]!.message.should.equal('response rejected');
        result.exceptionMessages[0]!.should.contain('scope failed');
    });
    it('should attribute the failure to response preparation', () => {
        result.recovery!.status.should.equal('NotNeeded');
        result.recovery!.startedCount.should.equal(0);
        recover.firstCall.args[2].should.equal('response');
    });
}));

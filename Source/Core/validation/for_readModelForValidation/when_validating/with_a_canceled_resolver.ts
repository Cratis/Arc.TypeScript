// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from '../../../commands/CommandResult.js';
import { a_command_with_validation_state, ChangeState, executionContext } from '../given/a_command_with_validation_state.js';

describe('when validating with a canceled resolver', () => {
    let context: a_command_with_validation_state;
    let results: CommandResult[];
    beforeEach(async () => {
        context = new a_command_with_validation_state();
        const application = await context.builder.build();
        results = [];
        try {
            for (const validate of [false, true]) {
                const controller = new AbortController();
                const canceled = new Error('Resolver canceled');
                context.resolver.lookup.callsFake(async () => { controller.abort(canceled); throw canceled; });
                const identity = executionContext('tenant-a', 'command-1', controller.signal);
                const command = Object.assign(new ChangeState(), { id: 'state-1', name: 'new' });
                results.push(validate ? await application.server.validate(command, identity) :
                    await application.server.execute(command, identity));
            }
        } finally { await application.dispose(); }
    });
    it('should return cancellation as a command exception rather than validatorFailed', () => {
        results.map(result => result.isSuccess).should.deep.equal([false, false]);
        results.map(result => result.hasExceptions).should.deep.equal([true, true]);
        results.forEach(result => {
            result.validationResults.should.have.lengthOf(0);
            result.exceptionMessages.should.deep.equal(['Error: Resolver canceled']);
        });
    });
    it('should not continue to the rule preparation or handler', () => {
        context.probe.validated.should.have.lengthOf(0);
        context.probe.prepared.should.have.lengthOf(0);
        context.probe.handled.should.have.lengthOf(0);
    });
});

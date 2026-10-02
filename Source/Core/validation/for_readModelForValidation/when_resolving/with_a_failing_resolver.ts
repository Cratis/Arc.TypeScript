// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from '../../../commands/CommandResult.js';
import { a_command_with_validation_state, validationRequest } from '../given/a_command_with_validation_state.js';

describe('when resolving validation state with a failing resolver', () => {
    let context: a_command_with_validation_state;
    let results: CommandResult[];
    let failure: Error;
    beforeEach(async () => {
        context = new a_command_with_validation_state();
        failure = new Error('Private resolver failure');
        context.resolver.lookup.rejects(failure);
        const application = await context.builder.build();
        results = [];
        try {
            for (const validate of [false, true]) {
                const response = (await application.server.handle(validationRequest('ChangeState', validate)))!;
                results.push(await response.json() as CommandResult);
            }
        } finally { await application.dispose(); }
    });
    it('should classify resolver failure as validatorFailed on both paths', () => {
        results.map(result => result.validationResults[0]!.reason).should.deep.equal(['validatorFailed', 'validatorFailed']);
        results.map(result => result.isSuccess).should.deep.equal([false, false]);
    });
    it('should propagate the original resolver error to the logger', () => {
        context.logged.should.have.lengthOf(2);
        context.logged.forEach(error => (error === failure).should.equal(true));
    });
    it('should not turn a resolver failure into optional absence or proceed', () => {
        context.probe.validated.should.have.lengthOf(0);
        context.probe.prepared.should.have.lengthOf(0);
        context.probe.handled.should.have.lengthOf(0);
    });
    it('should not expose resolver error details in validation results', () => {
        JSON.stringify(results).should.not.contain('Private resolver failure');
    });
});

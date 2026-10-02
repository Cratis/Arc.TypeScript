// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from '../../../commands/CommandResult.js';
import { ReadModelForCommandError } from '../../../commands/ReadModelForCommandError.js';
import { a_command_with_validation_state, validationRequest } from '../given/a_command_with_validation_state.js';

describe('when validating without required state', () => {
    let context: a_command_with_validation_state;
    let results: CommandResult[];
    let statuses: number[];
    beforeEach(async () => {
        context = new a_command_with_validation_state();
        context.resolver.lookup.resolves(null);
        const application = await context.builder.build();
        results = []; statuses = [];
        try {
            for (const validate of [false, true]) {
                const response = (await application.server.handle(validationRequest('RequireState', validate)))!;
                statuses.push(response.status);
                results.push(await response.json() as CommandResult);
            }
        } finally { await application.dispose(); }
    });
    it('should report validatorFailed rather than a rule failure on both routes', () => {
        statuses.should.deep.equal([400, 400]);
        results.map(result => result.validationResults[0]!.reason).should.deep.equal(['validatorFailed', 'validatorFailed']);
    });
    it('should log the required read model error', () => {
        context.logged.should.have.lengthOf(2);
        context.logged.forEach(error => {
            (error as Error).should.be.instanceOf(ReadModelForCommandError);
            (error as Error).message.should.equal('State was not found for the command key');
        });
    });
    it('should not invoke the handler', () => { context.probe.handled.should.have.lengthOf(0); });
});

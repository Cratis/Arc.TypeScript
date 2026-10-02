// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from '../../../commands/CommandResult.js';
import { a_command_with_validation_state, State, validationRequest } from '../given/a_command_with_validation_state.js';

describe('when validating through execute and validate routes', () => {
    let context: a_command_with_validation_state;
    let results: CommandResult[];
    let statuses: number[];
    beforeEach(async () => {
        context = new a_command_with_validation_state();
        const application = await context.builder.build();
        results = []; statuses = [];
        try {
            for (const validate of [false, true]) {
                const response = (await application.server.handle(validationRequest('ChangeState', validate)))!;
                statuses.push(response.status);
                results.push(await response.json() as CommandResult);
            }
        } finally { await application.dispose(); }
    });
    it('should reject the unchanged name on both routes', () => {
        statuses.should.deep.equal([400, 400]);
        results.map(result => result.validationResults).should.deep.equal([0, 1].map(() => [{
            severity: 3, message: 'State must exist and have a different name', members: ['name'], reason: 'rule'
        }]));
    });
    it('should resolve the command key on both routes', () => {
        context.resolver.lookup.callCount.should.equal(2);
        context.resolver.lookup.args.map(args => args.slice(0, 2)).should.deep.equal([[State, 'state-1'], [State, 'state-1']]);
    });
    it('should not run preparation or the handler', () => {
        context.probe.prepared.should.have.lengthOf(0);
        context.probe.handled.should.have.lengthOf(0);
    });
});

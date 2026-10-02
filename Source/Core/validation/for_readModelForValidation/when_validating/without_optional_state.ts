// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from '../../../commands/CommandResult.js';
import { a_command_with_validation_state, validationRequest } from '../given/a_command_with_validation_state.js';

for (const validate of [false, true]) {
    describe(`when validating without optional state on the ${validate ? 'validate' : 'execute'} route`, () => {
        let context: a_command_with_validation_state;
        let results: CommandResult[];
        beforeEach(async () => {
            context = new a_command_with_validation_state();
            context.resolver.lookup.resolves(null);
            const application = await context.builder.build();
            results = [];
            try {
                for (const allowMissing of [false, true]) {
                    context.probe.allowMissing = allowMissing;
                    const response = (await application.server.handle(validationRequest('ChangeState', validate)))!;
                    results.push(await response.json() as CommandResult);
                }
            } finally { await application.dispose(); }
        });
        it('should deliver null to the rule', () => { context.probe.validated.should.deep.equal([null, null]); });
        it('should let the rule reject absence with its own message', () => {
            results[0]!.isSuccess.should.equal(false);
            results[0]!.validationResults.should.deep.equal([{
                severity: 3, message: 'State must exist and have a different name', members: ['name'], reason: 'rule'
            }]);
        });
        it('should let the rule accept absence', () => { results[1]!.isSuccess.should.equal(true); });
        it('should run preparation and the handler with null only on successful execute', () => {
            context.probe.prepared.should.deep.equal(validate ? [] : [null]);
            context.probe.handled.should.deep.equal(validate ? [] : [null]);
            if (!validate) results[1]!.response!.should.equal(true);
        });
    });
}

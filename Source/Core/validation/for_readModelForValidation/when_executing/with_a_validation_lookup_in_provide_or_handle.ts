// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, key, validator } from '../../../index.js';
import type { CommandResult } from '../../../commands/CommandResult.js';
import { readModelForValidation } from '../../readModelForValidation.js';
import { a_command_with_validation_state, executionContext, State } from '../given/a_command_with_validation_state.js';

@command()
class LookupOutsideValidation {
    @field(String) @key() id = '';
    @field(Boolean) lookupInProvide = false;
    async provide(): Promise<State | null> {
        return this.lookupInProvide ? await readModelForValidation(State) : null;
    }
    async handle(prepared: State | null): Promise<State> {
        return prepared ?? await readModelForValidation(State);
    }
}
@validator(LookupOutsideValidation)
class LookupOutsideValidationValidator extends CommandValidator<LookupOutsideValidation> {
    constructor() {
        super();
        this.ruleFor(command => command.id).mustAsync(async () => (await readModelForValidation(State)).name !== '');
    }
}

for (const lookupInProvide of [true, false]) {
    describe(`when executing with a validation lookup in ${lookupInProvide ? 'provide' : 'handle'}`, () => {
        let context: a_command_with_validation_state;
        let result: CommandResult;
        beforeEach(async () => {
            context = new a_command_with_validation_state();
            context.builder.add(LookupOutsideValidation, LookupOutsideValidationValidator);
            const application = await context.builder.build();
            try {
                result = await application.server.executeCommand('LookupOutsideValidation', { id: 'state-1', lookupInProvide }, executionContext());
            } finally { await application.dispose(); }
        });
        it('should fail the command', () => { result.isSuccess.should.equal(false); });
        it('should report that command read models can only be resolved during validation', () => {
            result.exceptionMessages.should.deep.equal(['Error: Command read models can only be resolved during command validation']);
        });
        it('should resolve state only during validation', () => { context.resolver.lookup.calledOnce.should.equal(true); });
    });
}

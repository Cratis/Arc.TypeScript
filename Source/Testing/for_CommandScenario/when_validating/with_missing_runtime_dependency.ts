// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, currentServices, serviceToken, validator } from '@cratis/arc.core';
import { CommandScenario } from '../../index.js';

const absent = serviceToken<object>('absent-validator-rule-service');
@command()
class CheckedCommand { @field(String) name = 'ok'; handle(): void {} }
@validator(CheckedCommand)
class DependentValidator extends CommandValidator<CheckedCommand> {
    constructor() {
        super();
        this.ruleFor(command => command.name).mustAsync(async () => {
            await currentServices().resolve(absent);
            return true;
        });
    }
}

describe('when a command validator needs a missing runtime dependency', () => {
    let scenario: CommandScenario<CheckedCommand>;
    beforeEach(() => { scenario = CommandScenario.for(CheckedCommand, DependentValidator); });
    afterEach(async () => { await scenario.dispose(); });
    it('should reject through the real pipeline without satisfying authored-rule assertions', async () => {
        const result = await scenario.validate(new CheckedCommand());
        result.shouldHaveValidationErrorBecauseOf('validatorFailed');
        (() => result.shouldHaveValidationErrors()).should.throw('Expected authored validation errors');
    });
});

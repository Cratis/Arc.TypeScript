// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, Severity, validator } from '@cratis/arc.core';
import { CommandScenario } from '../../index.js';

@command()
class WarningCommand { @field(String) name = ''; handle(): void {} }
@validator(WarningCommand)
class WarningValidator extends CommandValidator<WarningCommand> {
    constructor() { super(); this.ruleFor(command => command.name).notEmpty().withSeverity(Severity.Warning); }
}

describe('when setting an allowed validation severity on a command scenario', () => {
    let scenario: CommandScenario<WarningCommand>;
    beforeEach(() => { scenario = CommandScenario.for(WarningCommand, WarningValidator).withAllowedValidationSeverity(Severity.Information); });
    afterEach(async () => { await scenario.dispose(); });
    it('should report warning-level failures above the configured threshold', async () => {
        (await scenario.validate(new WarningCommand())).shouldHaveValidationErrors();
    });
});

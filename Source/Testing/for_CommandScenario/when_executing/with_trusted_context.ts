// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario, type ScenarioCommandResult } from '../../index.js';
import { ContextCommand } from '../given/ContextCommand.js';

describe('when executing a command with trusted tenant context', () => {
    let scenario: CommandScenario<ContextCommand>;
    let result: ScenarioCommandResult;
    beforeEach(async () => {
        scenario = CommandScenario.for(ContextCommand);
        scenario.withContext({ tenantId: 'north', correlationId: 'trace-42' });
        result = await scenario.execute(new ContextCommand());
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should expose the context to the real handler', () => {
        result.shouldBeSuccessful();
        String(result.response).should.equal('north:trace-42');
    });
});

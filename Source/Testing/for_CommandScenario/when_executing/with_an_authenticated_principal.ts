// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario, type ScenarioCommandResult } from '../../index.js';
import { RestrictedCommand } from '../given/RestrictedCommand.js';

describe('when executing a restricted command with an authenticated principal', () => {
    let scenario: CommandScenario<RestrictedCommand>;
    let result: ScenarioCommandResult;
    beforeEach(async () => {
        scenario = CommandScenario.for(RestrictedCommand).withContext({ principal: {
            id: 'person-1', roles: [], isAuthenticated: true
        } });
        result = await scenario.execute(new RestrictedCommand());
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should authorize and execute the command', () => {
        result.shouldBeAuthorized().shouldBeSuccessful();
    });
});

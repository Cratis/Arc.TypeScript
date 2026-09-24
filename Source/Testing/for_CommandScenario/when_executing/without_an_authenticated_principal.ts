// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario, type ScenarioCommandResult } from '../../index.js';
import { RestrictedCommand } from '../given/RestrictedCommand.js';

describe('when executing a restricted command without an authenticated principal', () => {
    let scenario: CommandScenario<RestrictedCommand>;
    let result: ScenarioCommandResult;
    beforeEach(async () => {
        scenario = CommandScenario.for(RestrictedCommand);
        result = await scenario.execute(new RestrictedCommand());
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should reject the command through authorization', () => { result.shouldNotBeAuthorized(); });
    it('should not report a successful command', () => { result.shouldNotBeSuccessful(); });
});

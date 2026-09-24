// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario } from '../../index.js';
import { RestrictedCommand } from '../given/RestrictedCommand.js';

describe('when disposing a command scenario without executing', () => {
    let scenario: CommandScenario<RestrictedCommand>;
    beforeEach(async () => {
        scenario = CommandScenario.for(RestrictedCommand);
        await scenario.dispose();
    });
    it('should tolerate disposing a second time', async () => {
        await scenario.dispose();
    });
    it('should reject new execution', async () => {
        let failure: unknown;
        try { await scenario.execute(new RestrictedCommand()); }
        catch (error) { failure = error; }
        (failure as Error).message.should.equal('Scenario is disposed');
    });
});

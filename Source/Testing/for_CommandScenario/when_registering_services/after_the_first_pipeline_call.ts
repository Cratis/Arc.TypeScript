// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { serviceToken } from '@cratis/arc.core';
import { CommandScenario } from '../../index.js';
import { ContextCommand } from '../given/ContextCommand.js';

describe('when registering a scenario service after the first pipeline call', () => {
    let scenario: CommandScenario<ContextCommand>;
    let failure: unknown;
    beforeEach(async () => {
        scenario = CommandScenario.for(ContextCommand);
        await scenario.execute(new ContextCommand());
        try { scenario.services.addSingleton(serviceToken<object>('late'), {}); } catch (error) { failure = error; }
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should reject changes to the built service provider', () => {
        (failure as Error).message.should.equal('Register scenario services before the first pipeline call');
    });
});

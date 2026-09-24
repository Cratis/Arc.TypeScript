// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario } from '../../index.js';

class Undecorated { handle(): void {} }

describe('when disposing a command scenario after its application build fails', () => {
    let scenario: CommandScenario<Undecorated>;
    let buildFailure: unknown;
    let disposeFailure: unknown;
    beforeEach(async () => {
        scenario = CommandScenario.for(Undecorated);
        try { await scenario.execute(new Undecorated()); } catch (error) { buildFailure = error; }
        try { await scenario.dispose(); } catch (error) { disposeFailure = error; }
    });
    it('should report the build failure at execution without failing cleanup again', () => {
        (buildFailure as Error).message.should.contain('Not an Arc artifact');
        (disposeFailure === undefined).should.equal(true);
    });
});

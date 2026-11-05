// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { a_secured_command } from '../given/a_secured_command.js';

describe('when running the secured command as a reader', given(a_secured_command, context => {
    let result: ScenarioCommandResult;
    beforeAll(async () => { result = await context.signInWith('Reader').scenario.execute({ reason: 'Because' }); });
    afterAll(async () => { await context.scenario.dispose(); });
    it('should be denied by the cross-cutting gate', () => { result.isAuthorized.should.equal(false); });
    it('should not run the action', () => { context.actions.runs.should.equal(0); });
}));

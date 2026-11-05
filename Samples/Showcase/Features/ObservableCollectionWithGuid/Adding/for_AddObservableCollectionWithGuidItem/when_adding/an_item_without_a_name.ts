// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { an_item_to_add } from '../given/an_item_to_add.js';

describe('when adding an item without a name', given(an_item_to_add, context => {
    let result: ScenarioCommandResult;
    beforeAll(async () => { result = await context.scenario.execute({ name: '' }); });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should be rejected as invalid', () => { result.isValid.should.equal(false); });
    it('should not add anything', () => { context.items.all().value.should.have.lengthOf(0); });
}));

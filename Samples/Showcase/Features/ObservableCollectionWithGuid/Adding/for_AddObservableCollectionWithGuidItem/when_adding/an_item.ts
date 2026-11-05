// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { an_item_to_add } from '../given/an_item_to_add.js';

describe('when adding an item to the collection', given(an_item_to_add, context => {
    let result: ScenarioCommandResult;
    beforeAll(async () => { result = await context.scenario.execute({ name: 'First' }); });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should succeed', () => { result.shouldBeSuccessful(); });
    it('should add the item', () => { context.items.all().value.map(item => item.name).should.deep.equal(['First']); });
}));

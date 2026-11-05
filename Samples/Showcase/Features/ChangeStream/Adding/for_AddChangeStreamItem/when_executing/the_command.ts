// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { a_change_stream } from '../given/a_change_stream.js';

describe('when adding an item to the change stream', given(a_change_stream, context => {
    let result: ScenarioCommandResult;
    beforeAll(async () => {
        result = await context.scenario.execute({ name: 'First', value: 1 });
    });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should succeed', () => { result.shouldBeSuccessful(); });
    it('should add the item', () => { context.items.all().value.map(item => item.name).should.deep.equal(['First']); });
}));

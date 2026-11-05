// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { a_change_stream } from '../given/a_change_stream.js';

describe('when updating an item of the change stream', given(a_change_stream, context => {
    let result: ScenarioCommandResult;
    beforeAll(async () => {
        context.items.add('First', 1);
        result = await context.scenario.execute({ id: 1, value: 42 });
    });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should succeed', () => { result.shouldBeSuccessful(); });
    it('should change the value', () => { context.items.all().value[0]?.value.should.equal(42); });
}));

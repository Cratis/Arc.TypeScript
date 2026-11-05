// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { a_feed_post } from '../given/a_feed_post.js';

describe('when posting an empty message', given(a_feed_post, context => {
    let result: ScenarioCommandResult;
    beforeAll(async () => { result = await context.scenario.execute({ author: 'ada', text: '' }); });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should be rejected as invalid', () => { result.isValid.should.equal(false); });
    it('should not add anything to the feed', () => { context.feed.all().value.should.have.lengthOf(0); });
}));

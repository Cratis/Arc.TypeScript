// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { a_feed_post } from '../given/a_feed_post.js';

describe('when posting a message to the feed', given(a_feed_post, context => {
    let result: ScenarioCommandResult;
    beforeAll(async () => { result = await context.scenario.execute({ author: 'ada', text: 'Hello' }); });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should succeed through the command pipeline', () => { result.shouldBeSuccessful(); });
    it('should add the message to the feed', () => {
        context.feed.all().value.map(message => message.text).should.deep.equal(['Hello']);
    });
}));

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_live_feed } from '../given/a_live_feed.js';

describe('when observing the feed of one author', given(a_live_feed, context => {
    let result: Awaited<ReturnType<typeof context.byAuthor.collect>>;
    beforeEach(async () => {
        context.feed.post('ada', 'Hello');
        context.feed.post('grace', 'Hi');
        result = await context.byAuthor.collect(1, 1_000, { author: 'ada' });
    });
    afterAll(async () => { await context.all.dispose(); await context.byAuthor.dispose(); });
    it('should only include messages from that author', () => {
        result.emissions[0]?.data?.map(message => message.text).should.deep.equal(['Hello']);
    });
}));

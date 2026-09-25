// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { queryPage } from '@cratis/arc.core';
import { given } from '../../given.js';
import { a_projection } from '../../given/a_projection.js';

describe('when serving a Chronicle projection page', given(a_projection, context => {
    let result: Awaited<ReturnType<a_projection['query']>>;
    beforeEach(async () => {
        context.release.resetHistory();
        result = await context.query(queryPage([context.privateView, context.privateView], 2));
    });
    it('should release each item', () => { context.release.callCount.should.equal(2); });
    it('should return a released page', () => {
        (result.data as { name: string }[]).map(item => item.name).should.deep.equal(['plain', 'plain']);
    });
}));

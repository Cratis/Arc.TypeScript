// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../given/a_projection.js';

describe('when serving an array of Chronicle projections', given(a_projection, context => {
    let result: Awaited<ReturnType<a_projection['query']>>;
    beforeEach(async () => { result = await context.query([context.privateView, context.privateView]); });
    it('should release each item', () => { context.release.callCount.should.equal(2); });
    it('should return the released items', () => {
        (result.data as { name: string }[]).map(item => item.name).should.deep.equal(['plain', 'plain']);
    });
}));

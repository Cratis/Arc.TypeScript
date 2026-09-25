// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../given/a_projection.js';

describe('when serving an array returned by the Chronicle kernel', given(a_projection, context => {
    let result: Awaited<ReturnType<a_projection['query']>>;
    beforeEach(async () => {
        context.release.resetHistory();
        const items = await context.models().getAll(context.model);
        result = await context.query(items);
    });
    it('should keep the item unchanged', () => { ((result.data as object[])[0] === context.privateView).should.equal(true); });
    it('should not release the item twice', () => { context.release.called.should.equal(false); });
}));

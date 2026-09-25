// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../../given/a_projection.js';

describe('when serving a Chronicle projection query with one model', given(a_projection, context => {
    let result: Awaited<ReturnType<a_projection['query']>>;
    beforeEach(async () => {
        context.release.resetHistory();
        result = await context.query(context.privateView);
    });
    it('should serve the released model', () => { (result.data as { name: string }).name.should.equal('plain'); });
    it('should release it once', () => { context.release.calledOnce.should.equal(true); });
}));

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../../given/a_projection.js';

describe('when serving a protected model whose released children are protected instances', given(a_projection, context => {
    let result: Awaited<ReturnType<a_projection['query']>>;
    beforeEach(async () => {
        const releasedChild = new context.model();
        releasedChild.name = 'released child';
        context.release.callsFake(async () => Object.assign(new context.model(), { name: 'plain', children: [releasedChild] }));
        result = await context.query(context.privateView);
    });
    it('should serve the released model', () => { result.isSuccess.should.equal(true); });
    it('should serve its released children', () => { JSON.stringify(result.data).should.contain('released child'); });
}));

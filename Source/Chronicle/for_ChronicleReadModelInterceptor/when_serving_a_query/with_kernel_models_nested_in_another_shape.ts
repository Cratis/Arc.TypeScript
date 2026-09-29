// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../../given/a_projection.js';

describe('when serving Chronicle kernel models nested inside another shape', given(a_projection, context => {
    let result: Awaited<ReturnType<a_projection['query']>>;
    beforeEach(async () => {
        context.privateView.name = 'released';
        const model = await context.models().findInstanceById(context.model, '1');
        result = await context.query({ joined: { views: [model] } });
    });
    it('should serve them', () => { result.isSuccess.should.equal(true); });
    it('should serve the released value', () => { JSON.stringify(result.data).should.contain('released'); });
}));

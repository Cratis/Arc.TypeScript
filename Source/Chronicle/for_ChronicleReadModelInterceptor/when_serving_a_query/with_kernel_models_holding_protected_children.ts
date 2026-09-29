// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../../given/a_projection.js';

describe('when serving Chronicle kernel models whose children are protected instances', given(a_projection, context => {
    let direct: Awaited<ReturnType<a_projection['query']>>;
    let nested: Awaited<ReturnType<a_projection['query']>>;
    beforeEach(async () => {
        const child = new context.model();
        child.name = 'released child';
        const parent = new context.model();
        Object.assign(parent, { name: 'released', children: [child] });
        context.find.resolves(parent);
        context.release.resetHistory();
        const model = await context.models().findInstanceById(context.model, '1');
        direct = await context.query(model);
        nested = await context.query({ joined: { views: [model] } });
    });
    it('should serve the model with its children', () => { JSON.stringify(direct.data).should.contain('released child'); });
    it('should serve it nested in another shape', () => { nested.isSuccess.should.equal(true); });
    it('should not release it again', () => { context.release.called.should.equal(false); });
}));

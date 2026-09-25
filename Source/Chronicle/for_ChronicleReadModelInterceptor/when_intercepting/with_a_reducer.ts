// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../../given/a_projection.js';

describe('when intercepting a reducer read model', given(a_projection, context => {
    let result: object;
    beforeEach(async () => {
        context.release.resetHistory();
        context.getStore.resetHistory();
        result = await context.interceptor('reducer').intercept(context.reducedView);
    });
    it('should release a reducer model read outside Chronicle', () => { (result as { name: string }).name.should.equal('plain'); });
    it('should contact the tenant store', () => { context.getStore.calledOnce.should.equal(true); });
}));

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../../given/a_projection.js';

describe('when intercepting a projected model with compliance', given(a_projection, context => {
    let result: object;
    beforeEach(async () => {
        context.release.resetHistory();
        result = await context.interceptor('private').intercept(context.privateView);
    });
    it('should return released values', () => { (result as { name: string }).name.should.equal('plain'); });
    it('should use the tenant-scoped store', () => { context.getStore.calledWith(context.context).should.equal(true); });
    it('should release once', () => { context.release.calledOnce.should.equal(true); });
}));

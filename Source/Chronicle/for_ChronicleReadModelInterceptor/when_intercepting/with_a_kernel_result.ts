// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../given/a_projection.js';

describe('when intercepting a Chronicle kernel result', given(a_projection, context => {
    let result: object;
    beforeEach(async () => {
        context.getStore.resetHistory();
        context.release.resetHistory();
        const model = await context.models().findInstanceById(context.model, '1');
        result = await context.interceptor('private').intercept(model!);
    });
    it('should preserve the already released instance', () => { (result === context.privateView).should.equal(true); });
    it('should not release it again', () => { context.release.called.should.equal(false); });
    it('should only contact the store for the initial lookup', () => { context.getStore.calledOnce.should.equal(true); });
}));

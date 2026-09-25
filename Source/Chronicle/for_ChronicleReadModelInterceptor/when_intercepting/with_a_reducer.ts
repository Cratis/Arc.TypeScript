// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../given/a_projection.js';

describe('when intercepting a reducer read model', given(a_projection, context => {
    let result: object;
    beforeEach(async () => { result = await context.interceptor('reducer').intercept(context.reducedView); });
    it('should not release the SDK-released model again', () => { (result === context.reducedView).should.equal(true); });
    it('should not contact the store', () => { context.getStore.called.should.equal(false); });
}));

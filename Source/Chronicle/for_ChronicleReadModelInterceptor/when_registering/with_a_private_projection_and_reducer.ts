// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../given/a_projection.js';

describe('when registering a private projection alongside a reducer and a public projection', given(a_projection, context => {
    let count: number;
    beforeEach(async () => { count = await context.registeredInterceptors(); });
    it('should register interceptors for both protected models', () => { count.should.equal(2); });
}));

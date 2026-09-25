// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../../given/a_projection.js';

describe('when releasing a projected model fails', given(a_projection, context => {
    let failure: unknown;
    beforeEach(async () => {
        context.release.rejects(new Error('kernel rejected release'));
        try { await context.interceptor('private').intercept(context.privateView); }
        catch (error) { failure = error; }
    });
    it('should propagate the failure instead of returning ciphertext', () => {
        (failure as Error).message.should.equal('kernel rejected release');
    });
}));

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../../given/a_projection.js';

describe('when the Chronicle query release fails', given(a_projection, context => {
    let result: Awaited<ReturnType<a_projection['query']>>;
    beforeEach(async () => {
        context.release.rejects(new Error('release failed'));
        result = await context.query(context.privateView);
    });
    it('should fail the query rather than serve ciphertext', () => { result.isSuccess.should.equal(false); });
}));

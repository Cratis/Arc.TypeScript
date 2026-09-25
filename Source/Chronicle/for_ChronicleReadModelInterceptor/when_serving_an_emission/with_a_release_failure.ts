// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../given/a_projection.js';

describe('when a direct-read observable emission cannot be released', given(a_projection, context => {
    let result: Awaited<ReturnType<a_projection['observable']>>;
    beforeEach(async () => {
        context.release.resetHistory();
        context.release.rejects(new Error('release failed'));
        result = await context.observable(context.privateView);
    });
    it('should fail the emission rather than serve ciphertext', () => { result.isSuccess.should.equal(false); });
    it('should attempt release exactly once', () => { context.release.calledOnce.should.equal(true); });
}));

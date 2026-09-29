// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../../given/a_projection.js';

describe('when serving a protected model nested inside another shape', given(a_projection, context => {
    let result: Awaited<ReturnType<a_projection['query']>>;
    beforeEach(async () => {
        context.release.resetHistory();
        context.privateView.name = 'ciphertext';
        result = await context.query({ joined: { views: [context.privateView] } });
    });
    it('should fail the query', () => { result.isSuccess.should.equal(false); });
    it('should not serve the stored value', () => { JSON.stringify(result).should.not.contain('ciphertext'); });
}));

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { AuthenticationStatus } from '../AuthenticationStatus.js';
import { a_pinned_jwks } from './given/a_pinned_jwks.js';

describe('when receiving a different authorization scheme', given(a_pinned_jwks, context => {
    let status: AuthenticationStatus;
    beforeEach(async () => {
        status = (await context.verifier()(new Request('https://arc.example/api', {
            headers: { authorization: 'Basic abc' }
        }))).status;
    });
    it('should let another handler authenticate the request', () => { status.should.equal(AuthenticationStatus.Anonymous); });
}));

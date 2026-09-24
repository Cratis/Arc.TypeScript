// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { AuthenticationStatus } from '../AuthenticationStatus.js';
import { a_pinned_jwks } from './given/a_pinned_jwks.js';

describe('when verifying a token without issued-at', given(a_pinned_jwks, context => {
    let status: AuthenticationStatus;
    beforeEach(async () => {
        const { key } = await context.setup();
        try {
            const token = await context.token(key);
            status = (await context.verifier()(new Request('https://arc.example/api', {
                headers: { authorization: `Bearer ${token}` }
            }))).status;
        } finally { context.restore(); }
    });
    it('should accept a valid token without optional issued-at', () => { status.should.equal(AuthenticationStatus.Authenticated); });
}));

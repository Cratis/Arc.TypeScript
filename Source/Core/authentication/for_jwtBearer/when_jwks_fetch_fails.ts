// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { AuthenticationStatus } from '../AuthenticationStatus.js';
import { a_pinned_jwks } from './given/a_pinned_jwks.js';

describe('when the pinned JWKS cannot be fetched', given(a_pinned_jwks, context => {
    let status: AuthenticationStatus;
    beforeEach(async () => {
        const { key } = await context.setup();
        context.fetcher!.rejects(new Error('Network unavailable'));
        try {
            const token = await context.token(key);
            status = (await context.verifier()(new Request('https://arc.example/api', {
                headers: { authorization: `Bearer ${token}` }
            }))).status;
        } finally { context.restore(); }
    });
    it('should deny the credential rather than accepting unverified claims', () => { status.should.equal(AuthenticationStatus.Failed); });
}));

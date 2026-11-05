// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { an_authentication_query } from '../given/an_authentication_query.js';

describe('when performing the authenticated query as a signed in caller', given(an_authentication_query, context => {
    let authenticated: Awaited<ReturnType<typeof context.authenticated.perform>>;
    beforeEach(async () => {
        context.signIn();
        authenticated = await context.authenticated.perform({});
    });
    afterAll(async () => { await context.anonymous.dispose(); await context.authenticated.dispose(); });
    it('should serve the authenticated query', () => {
        authenticated.isSuccess.should.equal(true);
        String(authenticated.data?.endpoint).should.equal('authenticated');
    });
}));

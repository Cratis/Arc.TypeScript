// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { an_authentication_query } from '../given/an_authentication_query.js';

describe('when performing the authentication queries as an anonymous caller', given(an_authentication_query, context => {
    let anonymous: Awaited<ReturnType<typeof context.anonymous.perform>>;
    let authenticated: Awaited<ReturnType<typeof context.authenticated.perform>>;
    beforeEach(async () => {
        anonymous = await context.anonymous.perform({});
        authenticated = await context.authenticated.perform({});
    });
    afterAll(async () => { await context.anonymous.dispose(); await context.authenticated.dispose(); });
    it('should serve the anonymous query', () => { anonymous.isSuccess.should.equal(true); });
    it('should deny the authenticated query', () => { authenticated.isAuthorized.should.equal(false); });
}));

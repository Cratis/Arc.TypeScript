// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { principalFromCookies } from '../../../DemoUsers.js';
import { tenantFromCookies } from '../../SignIn.js';
import { a_cookie_header } from '../given/a_cookie_header.js';

describe('when resolving the session from cookies', given(a_cookie_header, context => {
    it('should sign in the demo user named by the cookie', () => { principalFromCookies(context.header)?.roles.should.deep.equal(['Admin']); });
    it('should select the tenant named by the cookie', () => { tenantFromCookies(context.header).should.equal('acme'); });
    it('should ignore an unknown user', () => { (principalFromCookies('showcase-user=mallory') === undefined).should.equal(true); });
    it('should never let a cookie name an unknown tenant', () => { tenantFromCookies('showcase-tenant=../admin').should.equal('default'); });
    it('should treat a missing cookie as anonymous in the default tenant', () => {
        (principalFromCookies(undefined) === undefined).should.equal(true);
        tenantFromCookies(undefined).should.equal('default');
    });
}));

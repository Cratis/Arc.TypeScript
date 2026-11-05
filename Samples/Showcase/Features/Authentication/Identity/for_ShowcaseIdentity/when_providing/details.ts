// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_signed_in_user } from '../given/a_signed_in_user.js';

describe('when providing identity details for a signed in admin', given(a_signed_in_user, context => {
    const details = () => context.provider.provide(context.principal, context.context);
    it('should use the principal name as the display name', () => { details().displayName.should.equal('Ada (admin)'); });
    it('should report the tenant of the request', () => { details().tenant.should.equal('acme'); });
    it('should report that the user is an admin', () => { details().isAdmin.should.equal(true); });
}));

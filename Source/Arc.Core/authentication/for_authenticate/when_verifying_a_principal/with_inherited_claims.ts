// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { authenticate } from '../../authenticate.js';
import { AuthenticationStatus } from '../../AuthenticationStatus.js';
import type { Principal } from '../../../identity/Principal.js';

should();

describe('when verifying a principal with inherited claims', () => {
    let verified: Principal;

    beforeEach(async () => {
        const original = Object.assign(Object.create({ claims: { tenant: 'north' } }) as Principal,
            { id: 'user', isAuthenticated: true, roles: ['Reader'] });
        verified = (await authenticate(new Request('http://localhost/'), [() => ({
            status: AuthenticationStatus.Authenticated, principal: original
        })])).principal!;
    });

    it('should not trust inherited claims', () => Object.hasOwn(verified, 'claims').should.equal(false));
});

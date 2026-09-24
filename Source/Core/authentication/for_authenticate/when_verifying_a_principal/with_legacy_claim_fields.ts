// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { authenticate } from '../../authenticate.js';
import { AuthenticationStatus } from '../../AuthenticationStatus.js';

should();

describe('when verifying a principal with legacy claim fields', () => {
    let preserved: boolean[];

    beforeEach(async () => {
        const values: readonly unknown[] = [[{ type: 'department', value: 'research' }], 'opaque', 42, null];
        preserved = await Promise.all(values.map(async extra => {
            const original = { id: '', isAuthenticated: true, roles: [''], claims: extra };
            const verified = (await authenticate(new Request('http://localhost/'), [() => ({
                status: AuthenticationStatus.Authenticated, principal: original
            })])).principal!;
            return verified.claims === extra;
        }));
    });

    it('should preserve non-dictionary legacy claims without rejecting them', () => preserved.should.deep.equal([true, true, true, true]));
});

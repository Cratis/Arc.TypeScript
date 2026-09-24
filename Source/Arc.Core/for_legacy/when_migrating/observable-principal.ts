// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { clonePrincipal } from '../../queries/observable/clonePrincipal.js';

should();

describe('per-subscription principal isolation', () => {
    it('should clone and freeze nested claims before callbacks can mutate shared identity', () => {
        const original = { id: 'alice', isAuthenticated: true, roles: ['reader'],
            claims: { nested: { value: 'trusted' } } };
        const copy = clonePrincipal(original)!;
        should().not.equal(copy, original);
        should().equal(Object.isFrozen(copy), true);
        should().equal(Object.isFrozen(copy.roles), true);
        const claims = copy.claims as { nested: { value: string } };
        should().equal(Object.isFrozen(claims.nested), true);
        (() => { claims.nested.value = 'untrusted'; }).should.throw(TypeError);
        original.claims.nested.value.should.equal('trusted');
    });
});

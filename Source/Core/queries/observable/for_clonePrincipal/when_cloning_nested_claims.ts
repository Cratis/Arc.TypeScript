// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { clonePrincipal } from '../clonePrincipal.js';

should();

describe('when cloning nested claims', () => {
    let original: { id: string; isAuthenticated: boolean; roles: string[]; claims: { nested: { value: string } } };
    let copy: NonNullable<ReturnType<typeof clonePrincipal>>;
    let claims: { nested: { value: string } };

    beforeEach(() => {
        original = { id: 'alice', isAuthenticated: true, roles: ['reader'], claims: { nested: { value: 'trusted' } } };
        copy = clonePrincipal(original)!;
        claims = copy.claims as { nested: { value: string } };
    });

    it('should create a separate principal', () => { (copy === original).should.equal(false); });
    it('should freeze the principal', () => { Object.isFrozen(copy).should.equal(true); });
    it('should freeze the roles', () => { Object.isFrozen(copy.roles).should.equal(true); });
    it('should freeze nested claims', () => { Object.isFrozen(claims.nested).should.equal(true); });
    it('should reject mutations of nested claims', () => {
        (() => { claims.nested.value = 'untrusted'; }).should.throw(TypeError);
    });
    it('should leave the original identity unchanged', () => { original.claims.nested.value.should.equal('trusted'); });
});

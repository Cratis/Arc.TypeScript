// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { authenticate } from '../../authenticate.js';
import { AuthenticationStatus } from '../../AuthenticationStatus.js';
import type { Principal } from '../../../identity/Principal.js';

should();

describe('when verifying a principal with own role and claim extensions', () => {
    let verified: Principal;
    let id: string;
    let membership: string;
    let extension: { raw: boolean };
    let rolesBeforeMutation: string[];
    let membershipBeforeMutation: string;
    let roles: string[];

    beforeEach(async () => {
        roles = ['Reader', ''];
        const claims = { membership: 'north,'.repeat(100), unused: '\u0000'.repeat(300) };
        extension = { raw: true };
        const original = { id: 'a'.repeat(400), name: '\u0000', isAuthenticated: true, roles, claims, extension };
        id = original.id;
        membership = claims.membership;
        verified = (await authenticate(new Request('http://localhost/'), [() => ({ status: AuthenticationStatus.Authenticated, principal: original })])).principal!;
        rolesBeforeMutation = [...verified.roles];
        membershipBeforeMutation = (verified.claims as Record<string, string>).membership!;
        roles.push('Admin');
        claims.membership = 'south';
    });

    it('should retain the full identity id', () => verified.id.should.equal(id));
    it('should retain the original empty role', () => rolesBeforeMutation.should.deep.equal(['Reader', '']));
    it('should retain the original claim', () => membershipBeforeMutation.should.equal(membership));
    it('should retain nonclaim extensions', () => (verified as Principal & { extension: typeof extension }).extension.should.equal(extension));
    it('should freeze the principal', () => Object.isFrozen(verified).should.equal(true));
    it('should freeze the roles', () => Object.isFrozen(verified.roles).should.equal(true));
    it('should freeze the claim dictionary', () => Object.isFrozen(verified.claims).should.equal(true));
    it('should not reflect later changes to roles', () => verified.roles.should.deep.equal(['Reader', '']));
    it('should not reflect later changes to claims', () => (verified.claims as Record<string, string>).membership!.should.equal('north,'.repeat(100)));
});

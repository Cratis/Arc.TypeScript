// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';

should();
describe('when resolving tenants with large identity claims', () => {
    let response: { status: number; tenant: string };
    let inherited: number;
    beforeEach(async () => {
        const server = new ArcServer({ nativePrincipal: true, tenancy: { sources: ['claim'], claimType: 'tenant', membershipClaim: 'memberships', required: true },
            queries: [defineQuery({ name: 'Tenant', schema: z.object({}), authorization: { roles: ['Reader'] }, perform: (_input, context) => context.tenantId })] });
        const roles = Array.from({ length: 70 }, (_, index) => `group-${index}`).concat('Reader');
        const identity = { id: 'u'.repeat(1000), name: '', isAuthenticated: true, roles,
            claims: { tenant: 'north', memberships: `${'other,'.repeat(100)}north`, unused: '\u0000'.repeat(500) }, extension: 'kept' };
        const result = (await server.handle(new Request('http://arc.invalid/api/tenant'), { principal: identity }))!;
        response = { status: result.status, tenant: (await result.json()).data };
        const inheritedClaims = Object.assign(Object.create({ tenant: 'north' }) as Record<string, string>, { memberships: 'north' });
        inherited = (await server.handle(new Request('http://arc.invalid/api/tenant'), { principal: { ...identity, claims: inheritedClaims } }))!.status;
        await server.dispose();
    });
    it('should accept a trusted own claim without limiting unused identity data', () => response.should.deep.equal({ status: 200, tenant: 'north' }));
    it('should reject an inherited tenant claim', () => inherited.should.equal(400));
});

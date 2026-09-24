// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { identityGet, identityPrincipal } from '../given/an_identity_request.js';

should();
describe('when resolving tenants with ordered sources', () => {
    let resolved: string[];
    let forbidden: number;
    let invalidHeader: number;
    let anonymous: number;
    let custom: string;
    beforeEach(async () => {
        const server = new ArcServer({ nativePrincipal: true, tenancy: { sources: ['subdomain', 'claim', 'header'], baseDomain: 'example.com', claimType: 'tenant', required: true, membershipClaim: 'memberships' },
            queries: [defineQuery({ name: 'Tenant', schema: z.object({}), authorization: { authenticated: true }, perform: (_input, context) => context.tenantId })] });
        const run = (authority: string, header = 'south') => server.handle(new Request('http://arc.invalid/api/tenant', { headers: { 'x-cratis-tenant-id': header, 'x-forwarded-host': 'north.example.com' } }), { principal: identityPrincipal, authority });
        resolved = await Promise.all(['south.example.com', 'deep.south.example.com', 'unrelated.test'].map(async authority =>
            (await (await run(authority))!.json()).data));
        forbidden = (await run('evil.example.com'))!.status;
        invalidHeader = (await run('south.example.com', '../wrong'))!.status;
        anonymous = (await server.handle(new Request('http://arc.invalid/api/tenant', { headers: { 'x-cratis-tenant-id': 'north' } }), { authority: 'example.com' }))!.status;
        const authoritative = new ArcServer({ nativePrincipal: true, tenancy: { sources: ['fixed'], fixed: 'north', required: true }, resolveTenant: () => 'custom',
            queries: [defineQuery({ name: 'Tenant', schema: z.object({}), perform: (_input, context) => context.tenantId })] });
        custom = (await (await identityGet(authoritative, '/api/tenant'))!.json()).data;
        await Promise.all([server.dispose(), authoritative.dispose()]);
    });
    it('should resolve subdomains before authenticated claims and headers', () => resolved.should.deep.equal(['south', 'north', 'north']));
    it('should enforce tenant membership for a selected subdomain', () => forbidden.should.equal(403));
    it('should ignore an invalid header when a trusted subdomain resolves', () => invalidHeader.should.equal(200));
    it('should reject anonymous tenant claims', () => anonymous.should.equal(401));
    it('should honor an explicitly configured tenant resolver over fixed sources', () => custom.should.equal('custom'));
});

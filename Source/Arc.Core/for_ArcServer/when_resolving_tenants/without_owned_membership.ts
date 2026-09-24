// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { defineQuery } from '../../queries/defineQuery.js';
import type { Principal } from '../../identity/Principal.js';
import { identityGet, identityPrincipal } from '../given/an_identity_request.js';

should();
describe('when resolving tenants without owned membership', () => {
    let rejected: { status: number; authorized: boolean }[];
    let invalid: { status: number; length: number }[];
    let allowed: number[];
    let invoked: number;
    let unauthenticated: number;
    let noInherited: string;
    beforeEach(async () => {
        invoked = 0;
        const server = new ArcServer({ nativePrincipal: true, tenancy: { sources: ['header'], membershipClaim: 'constructor' },
            commands: [defineCommand({ name: 'Save', schema: z.object({}), handle: () => { invoked++; return 1; } })],
            queries: [defineQuery({ name: 'Read', schema: z.object({}), perform: () => { invoked++; return 1; } })] });
        const request = (path: string, identity?: Principal, tenant = 'north') => server.handle(new Request(`http://arc.invalid${path}`, {
            method: path.includes('save') ? 'POST' : 'GET', headers: { 'x-cratis-tenant-id': tenant }, ...(path.includes('save') ? { body: '{}' } : {})
        }), { principal: identity });
        rejected = []; invalid = []; allowed = [];
        for (const path of ['/api/save', '/api/read']) {
            for (const identity of [undefined, { ...identityPrincipal, claims: {} as Record<string, string> }, { ...identityPrincipal, claims: { constructor: 'south' } }]) {
                const response = (await request(path, identity))!;
                rejected.push({ status: response.status, authorized: (await response.json()).isAuthorized });
            }
            const bad = (await request(path, { ...identityPrincipal, claims: { constructor: 'north' } }, '../bad'))!;
            invalid.push({ status: bad.status, length: (await bad.json()).validationResults.length });
            allowed.push((await request(path, { ...identityPrincipal, claims: { constructor: 'north' } }))!.status);
        }
        const anonymous = new ArcServer({ tenancy: { sources: ['fixed'], fixed: 'north', membershipClaim: 'memberships' },
            queries: [defineQuery({ name: 'Read', schema: z.object({}), perform: () => { invoked++; return 1; } })] });
        unauthenticated = (await identityGet(anonymous, '/api/read'))!.status;
        const claim = new ArcServer({ nativePrincipal: true, tenancy: { sources: ['claim'], claimType: 'toString' },
            queries: [defineQuery({ name: 'Read', schema: z.object({}), perform: (_input, context) => context.tenantId ?? 'none' })] });
        noInherited = (await (await claim.handle(new Request('http://arc.invalid/api/read'), { principal: { ...identityPrincipal, claims: {} } }))!.json()).data;
        await Promise.all([server.dispose(), anonymous.dispose(), claim.dispose()]);
    });
    it('should deny commands and queries without owned tenant membership', () => {
        rejected.should.have.lengthOf(6);
        rejected.forEach(result => result.should.deep.equal({ status: 403, authorized: false }));
    });
    it('should preserve validation envelopes for invalid selected tenants', () => invalid.should.deep.equal([{ status: 400, length: 1 }, { status: 400, length: 1 }]));
    it('should allow owned membership to execute each operation exactly once', () => {
        allowed.should.deep.equal([200, 200]);
        invoked.should.equal(2);
    });
    it('should reject unauthenticated membership checks', () => unauthenticated.should.equal(403));
    it('should ignore inherited claim keys', () => noInherited.should.equal('none'));
});

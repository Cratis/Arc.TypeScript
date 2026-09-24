// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, defineQuery } from '../../index.js';

should();

const principal = { id: 'user', isAuthenticated: true, roles: ['Reader'] };

describe('when tenant strategies consume handler-defined claims', () => {
    it('should reject nonstring selected tenant claims without invoking coercion or the query', async () => {
        let invocations = 0;
        let coercions = 0;
        const server = new ArcServer({ nativePrincipal: true,
            tenancy: { sources: ['claim'], claimType: 'tenant', required: true },
            queries: [defineQuery({ name: 'Read', schema: z.object({}), perform: () => { invocations++; return 'secret'; } })] });
        try {
            for (const claims of [42, null, 'opaque', ['north'], { tenant: 42 }, { tenant: ['north'] },
                { tenant: { toString: () => { coercions++; return 'north'; } } }]) {
                const result = (await server.handle(new Request('http://arc.invalid/api/read'), { principal: { ...principal, claims } }))!;
                result.status.should.equal(400);
                (await result.json()).isValid.should.equal(false);
            }
            invocations.should.equal(0);
            coercions.should.equal(0);
        } finally { await server.dispose(); }
    });
    it('should deny nonstring membership values rather than invoking their methods', async () => {
        let invocations = 0;
        let splits = 0;
        const server = new ArcServer({ nativePrincipal: true,
            tenancy: { sources: ['fixed'], fixed: 'north', membershipClaim: 'memberships' },
            queries: [defineQuery({ name: 'Read', schema: z.object({}), perform: () => { invocations++; return 'secret'; } })] });
        try {
            for (const claims of [null, [], { memberships: 42 }, { memberships: ['north'] },
                { memberships: { split: () => { splits++; return ['north']; } } }]) {
                const result = (await server.handle(new Request('http://arc.invalid/api/read'), { principal: { ...principal, claims } }))!;
                result.status.should.equal(403);
                (await result.json()).isAuthorized.should.equal(false);
            }
            invocations.should.equal(0);
            splits.should.equal(0);
        } finally { await server.dispose(); }
    });
});

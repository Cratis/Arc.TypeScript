// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { TenantResolverType } from '../../tenancy/TenantResolverType.js';
import { afterAll, beforeEach, describe, it, should } from 'vitest';
import sinon from 'sinon';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';

should();

const principal = { id: 'user', isAuthenticated: true, roles: ['Reader'] };

describe('when resolving tenant claims with nonstring claims', () => {
    const perform = sinon.stub().returns('secret');
    const coerce = sinon.stub().returns('north');
    const server = new ArcServer({ nativePrincipal: true,
        tenancy: { sources: [TenantResolverType.Claim], claimType: 'tenant', required: true },
        queries: [defineQuery({ name: 'Read', schema: z.object({}), perform })] });
    let statuses: number[];
    let validity: boolean[];

    beforeEach(async () => {
        statuses = [];
        validity = [];
        for (const claims of [42, null, 'opaque', ['north'], { tenant: 42 }, { tenant: ['north'] }, { tenant: { toString: coerce } }]) {
            const response = (await server.handle(new Request('http://arc.invalid/api/read'), { principal: { ...principal, claims } }))!;
            statuses.push(response.status);
            validity.push((await response.json()).isValid);
        }
    });
    afterAll(async () => server.dispose());

    it('should reject every nonstring tenant claim', () => statuses.should.deep.equal([400, 400, 400, 400, 400, 400, 400]));
    it('should report invalid results', () => validity.should.deep.equal([false, false, false, false, false, false, false]));
    it('should not execute the query', () => perform.callCount.should.equal(0));
    it('should not coerce claim objects', () => coerce.callCount.should.equal(0));
});

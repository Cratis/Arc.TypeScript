// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterAll, beforeEach, describe, it, should } from 'vitest';
import sinon from 'sinon';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';

should();

const principal = { id: 'user', isAuthenticated: true, roles: ['Reader'] };

describe('when checking tenant membership with nonstring membership', () => {
    const perform = sinon.stub().returns('secret');
    const split = sinon.stub().returns(['north']);
    const server = new ArcServer({ nativePrincipal: true,
        tenancy: { sources: ['fixed'], fixedTenantId: 'north', membershipClaim: 'memberships' },
        queries: [defineQuery({ name: 'Read', schema: z.object({}), perform })] });
    let statuses: number[];
    let authorization: boolean[];

    beforeEach(async () => {
        statuses = [];
        authorization = [];
        for (const claims of [null, [], { memberships: 42 }, { memberships: ['north'] }, { memberships: { split } }]) {
            const response = (await server.handle(new Request('http://arc.invalid/api/read'), { principal: { ...principal, claims } }))!;
            statuses.push(response.status);
            authorization.push((await response.json()).isAuthorized);
        }
    });
    afterAll(async () => server.dispose());

    it('should deny every nonstring membership', () => statuses.should.deep.equal([403, 403, 403, 403, 403]));
    it('should report unauthorized results', () => authorization.should.deep.equal([false, false, false, false, false]));
    it('should not execute the query', () => perform.callCount.should.equal(0));
    it('should not call methods on membership values', () => split.callCount.should.equal(0));
});

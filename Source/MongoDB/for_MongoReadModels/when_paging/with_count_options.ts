// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import type { ClientSession } from 'mongodb';
import { given } from '../../given.js';
import { a_tenant_collection, executionContext } from '../given/a_tenant_collection.js';

should();
describe('when paging with count options', given(a_tenant_collection, context => {
    let result: Awaited<ReturnType<typeof context.models.page>>;
    let signal: AbortSignal;
    let session: ClientSession;
    const options = { collation: { locale: 'en', strength: 2 }, hint: 'owner_1', readPreference: 'secondary' as const,
        readConcern: { level: 'majority' as const }, maxTimeMS: 1000, comment: 'query', signal: new AbortController().signal };
    beforeEach(async () => {
        const ctx = executionContext('a');
        signal = ctx.signal;
        session = {} as ClientSession;
        result = await context.models.page(ctx, 'alice', { page: 1, pageSize: 1 }, { ...options, session });
    });
    it('should resolve the tenant database', () => context.db.calledWith('app_a').should.equal(true));
    it('should count using the same query semantics without paging', () => {
        context.countDocuments.calledWithMatch({ owner: 'alice' }, { ...options, session, signal }).should.equal(true);
    });
    it('should find using the caller options and authoritative signal', () => {
        context.find.calledWithMatch({ owner: 'alice' }, { ...options, session, sort: { _id: 1 }, signal }).should.equal(true);
    });
    it('should skip and limit the page', () => {
        context.skip.calledWith(1).should.equal(true);
        context.limit.calledWith(1).should.equal(true);
    });
    it('should return the page and total', () => result.should.deep.equal({ items: [context.doc], paging: { page: 1, size: 1, totalItems: 3, totalPages: 3 } }));
}));

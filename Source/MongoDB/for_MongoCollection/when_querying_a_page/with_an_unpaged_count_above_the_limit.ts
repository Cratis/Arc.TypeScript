// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import type { Collection, Db, Document } from 'mongodb';
import { QueryPagingRequired } from '@cratis/arc.core';
import { MongoCollection } from '../../MongoCollection.js';
import { a_replica_set } from '../given/a_replica_set.js';
import { TaskRecord } from '../given/TaskRecord.js';
import { given } from '../../given.js';

should();
describe('when querying a page with an unpaged count above the limit', given(a_replica_set, context => {
    let failure: unknown;
    beforeEach(async () => {
        const native = { countDocuments: async () => 2,
            find: () => { throw new Error('The bounded read should not start'); } } as unknown as Collection<Document>;
        const models = new MongoCollection(native, {} as Db, TaskRecord, context.context('a'), { maxPageSize: 1 });
        try { await models.queryPage({}, {}); }
        catch (error) { failure = error; }
    });
    it('should require paging', () => (failure as Error).message.should.equal(
        'The result exceeds the maximum page size of 1; request paging'));
    it('should signal a paging validation', () => (failure as Error).should.be.instanceOf(QueryPagingRequired));
}));

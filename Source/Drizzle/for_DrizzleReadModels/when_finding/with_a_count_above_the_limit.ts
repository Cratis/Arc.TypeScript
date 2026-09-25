// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { QueryPagingRequired } from '@cratis/arc.core';
import { given } from '../../given.js';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';
import { TaskRecord } from '../given/TaskRecord.js';

should();
describe('when finding with a count above the limit', given(a_sqlite_database, context => {
    let failure: unknown;
    beforeEach(async () => {
        await context.establish();
        const models = new DrizzleReadModels(context.database, context.table, TaskRecord, 1);
        try { await models.find(undefined); }
        catch (error) { failure = error; }
    });
    afterEach(() => context.close());
    it('should signal a paging limit', () => (failure as Error).should.be.instanceOf(QueryPagingRequired));
    it('should direct callers to the paged operation', () => (failure as Error).message.should.equal(
        'The result exceeds the maximum of 1 items; use queryPage for paged results'));
}));

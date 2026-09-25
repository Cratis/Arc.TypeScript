// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';
import { TaskRecord } from '../given/TaskRecord.js';

should();
describe('when querying a page without paging', given(a_sqlite_database, context => {
    let result: Awaited<ReturnType<DrizzleReadModels<TaskRecord>['queryPage']>>;
    beforeEach(async () => {
        await context.establish();
        result = await new DrizzleReadModels(context.database, context.table, TaskRecord, 2).queryPage(undefined, {});
    });
    afterEach(() => context.close());
    it('should return all rows within the configured bound', () => result.items.should.have.lengthOf(2));
    it('should retain the full count', () => result.totalItems.should.equal(2));
}));

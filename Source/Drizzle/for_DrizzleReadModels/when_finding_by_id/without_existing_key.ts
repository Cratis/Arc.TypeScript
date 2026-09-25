// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { given } from '../../given.js';
import { TaskRecord } from '../given/TaskRecord.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';

should();
describe('when finding a missing Drizzle model by id', given(a_sqlite_database, context => {
    let record: TaskRecord | null;
    beforeEach(async () => {
        await context.establish();
        record = await new DrizzleReadModels(context.database, context.table, TaskRecord)
            .findById('22112233-4455-6677-8899-aabbccddeeff');
    });
    afterEach(() => context.close());
    it('should return null', () => { should().equal(record, null); });
}));

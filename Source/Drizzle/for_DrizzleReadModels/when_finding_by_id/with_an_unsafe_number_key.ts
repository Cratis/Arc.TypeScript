// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { given } from '../../given.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';
import { NumberTask } from '../given/NumberTask.js';

should();
describe('when finding by an unsafe number key', given(a_sqlite_database, context => {
    const table = sqliteTable('number_tasks', { id: integer('id').primaryKey(), title: text('title') });
    let failure: Error | undefined;
    beforeEach(async () => {
        await context.establish();
        failure = await new DrizzleReadModels(context.database, table, NumberTask)
            .findById('9007199254740992').then(() => undefined, reason => reason as Error);
    });
    afterEach(() => context.close());
    it('should reject an integer that cannot be represented safely', () => {
        should().exist(failure);
        failure!.should.be.instanceOf(TypeError);
        failure!.message.should.equal('Invalid Drizzle number key');
    });
}));

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { given } from '../../given.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';
import { TaskRecord } from '../given/TaskRecord.js';

should();
describe('when finding by an invalid GUID key', given(a_sqlite_database, context => {
    let failure: Error | undefined;
    beforeEach(async () => {
        await context.establish();
        failure = await new DrizzleReadModels(context.database, context.table, TaskRecord)
            .findById('not-a-guid').then(() => undefined, reason => reason as Error);
    });
    afterEach(() => context.close());
    it('should reject the malformed GUID before binding it', () => {
        should().exist(failure);
        failure!.should.be.instanceOf(TypeError);
        failure!.message.should.equal('Invalid Drizzle Guid key');
    });
}));

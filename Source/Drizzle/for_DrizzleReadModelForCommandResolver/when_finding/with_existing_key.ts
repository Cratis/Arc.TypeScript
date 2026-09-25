// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { Guid } from '@cratis/fundamentals';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { given } from '../../given.js';
import { TaskRecord } from '../../for_DrizzleReadModels/given/TaskRecord.js';
import { a_command_with_sqlite } from '../given/a_command_with_sqlite.js';

should();
describe('when finding an existing Drizzle model by command key', given(a_command_with_sqlite, context => {
    let record: TaskRecord | null;
    beforeEach(async () => {
        await context.establish();
        record = await new DrizzleReadModels(context.sqlite.database, context.sqlite.table, TaskRecord)
            .findById('00112233-4455-6677-8899-aabbccddeeff');
    });
    afterEach(() => context.close());
    it('should deserialize the stored UUID and row', () => {
        record!.id.should.be.instanceOf(Guid);
        record!.title.should.equal('z');
    });
}));

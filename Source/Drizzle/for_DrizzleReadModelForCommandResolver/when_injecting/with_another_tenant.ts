// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_sqlite_database } from '../../for_DrizzleReadModels/given/a_sqlite_database.js';
import { a_command_with_sqlite } from '../given/a_command_with_sqlite.js';

should();
describe('when injecting a model from another tenant', given(a_command_with_sqlite, context => {
    const other = new a_sqlite_database();
    let result: Awaited<ReturnType<typeof context.application.server.executeCommand>>;
    beforeEach(async () => {
        await other.establish();
        other.database.delete(other.table).run();
        await context.establish(other);
        result = await context.application.server.executeCommand('RenameTask',
            { id: '00112233-4455-6677-8899-aabbccddeeff' }, context.identity('b'));
    });
    afterEach(async () => { await context.close(); other.close(); });
    it('should not see the row in tenant a', () => {
        result.isSuccess.should.equal(false);
        result.validationResults[0]!.message.should.equal('TaskRecord was not found for the command key');
    });
}));

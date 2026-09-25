// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { DrizzleReadModelForCommandResolver } from '../../DrizzleReadModelForCommandResolver.js';
import { given } from '../../given.js';
import { TaskRecord } from '../../for_DrizzleReadModels/given/TaskRecord.js';
import { a_sqlite_database } from '../../for_DrizzleReadModels/given/a_sqlite_database.js';

should();
class Unregistered {}
describe('when checking support for an unregistered model', given(a_sqlite_database, context => {
    let supported: boolean;
    beforeEach(() => {
        const resolver = new DrizzleReadModelForCommandResolver({ dialect: 'sqlite', database: {},
            readModels: [{ type: TaskRecord, table: context.table }] });
        supported = resolver.supports(Unregistered);
    });
    it('should not claim the model', () => { supported.should.equal(false); });
}));

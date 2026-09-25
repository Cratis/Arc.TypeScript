// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { field } from '@cratis/fundamentals';
import { given } from '../../given.js';
import { a_sqlite_database } from '../../for_DrizzleReadModels/given/a_sqlite_database.js';
import { a_builder } from '../given/a_builder.js';
import '../../index.js';

should();
class TitleOnly { @field(String) title!: string; }
describe('when registering a query-only model without a declared key field', given(a_builder, context => {
    const sqlite = new a_sqlite_database();
    let registered: typeof context.builder;
    beforeEach(() => {
        registered = context.builder.withDrizzle({ dialect: 'sqlite', database: {},
            readModels: [{ type: TitleOnly, table: sqlite.table }] });
    });
    it('should retain its query registration', () => { registered.should.equal(context.builder); });
}));

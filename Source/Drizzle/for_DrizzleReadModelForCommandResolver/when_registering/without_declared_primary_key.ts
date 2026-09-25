// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication } from '@cratis/arc.core';
import { field } from '@cratis/fundamentals';
import { given } from '../../given.js';
import { a_sqlite_database } from '../../for_DrizzleReadModels/given/a_sqlite_database.js';
import '../../index.js';

should();
class TitleOnly { @field(String) title!: string; }
describe('when registering a read model without its primary key field', given(a_sqlite_database, context => {
    let failure: Error | undefined;
    beforeEach(() => {
        try {
            ArcApplication.createBuilder().withDrizzle({ dialect: 'sqlite', database: {},
                readModels: [{ type: TitleOnly, table: context.table }] });
        } catch (error) { failure = error as Error; }
    });
    it('should reject a key that cannot be converted by the model codec', () => {
        failure!.message.should.contain('requires @field metadata for primary key: id');
    });
}));

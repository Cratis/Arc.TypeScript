// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { Severity } from '@cratis/arc.core';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleReadModelForCommandResolver } from '../../DrizzleReadModelForCommandResolver.js';
import { DrizzleDialect } from '../../DrizzleDialect.js';
import { given } from '../../given.js';
import { TaskRecord } from '../../for_DrizzleReadModels/given/TaskRecord.js';
import { a_builder } from '../../for_withDrizzle/given/a_builder.js';
import '../../index.js';

should();
describe('when checking support with several column primary keys', given(a_builder, context => {
    const table = sqliteTable('compound', {
        id: text('id').primaryKey(), locale: text('locale').primaryKey(), title: text('title')
    });
    let supported: boolean;
    beforeEach(async () => {
        context.builder.withDrizzle({ dialect: DrizzleDialect.SQLite, database: {}, readModels: [{ type: TaskRecord, table }] });
        const app = await context.builder.build();
        const scope = app.server.services.createScope({ tenantId: 'default', principal: undefined, allowedSeverity: Severity.Warning,
            signal: new AbortController().signal, correlationId: crypto.randomUUID() });
        try {
            supported = (await scope.resolve(DrizzleReadModelForCommandResolver)).supports(TaskRecord);
        } finally { await scope.dispose(); await app.dispose(); }
    });
    it('should not claim a model with several primary key columns', () => { supported.should.equal(false); });
}));

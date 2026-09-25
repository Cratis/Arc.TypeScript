// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { Severity } from '@cratis/arc.core';
import { field } from '@cratis/fundamentals';
import { DrizzleReadModelForCommandResolver } from '../../DrizzleReadModelForCommandResolver.js';
import { given } from '../../given.js';
import { a_sqlite_database } from '../../for_DrizzleReadModels/given/a_sqlite_database.js';
import { a_builder } from '../../for_withDrizzle/given/a_builder.js';
import '../../index.js';

should();
class TitleOnly { @field(String) title!: string; }
describe('when checking support without a declared key field', given(a_builder, context => {
    const sqlite = new a_sqlite_database();
    let supported: boolean;
    beforeEach(async () => {
        context.builder.withDrizzle({ dialect: 'sqlite', database: {}, readModels: [{ type: TitleOnly, table: sqlite.table }] });
        const app = await context.builder.build();
        const scope = app.server.services.createScope({ tenantId: 'default', principal: undefined, allowedSeverity: Severity.Warning,
            signal: new AbortController().signal, correlationId: crypto.randomUUID() });
        try {
            supported = (await scope.resolve(DrizzleReadModelForCommandResolver)).supports(TitleOnly);
        } finally { await scope.dispose(); await app.dispose(); }
    });
    it('should not claim the query-only model', () => { supported.should.equal(false); });
}));

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, Severity } from '@cratis/arc.core';
import { DrizzleDialect } from '../../DrizzleDialect.js';
import { drizzleReadModel } from '../../drizzleToken.js';
import '../../index.js';
import { TaskRecord } from '../given/TaskRecord.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';

describe('when starting an observation without enabling it in withDrizzle', () => {
    let currentError: string;
    let subscriptionError: string;
    beforeEach(async () => {
        const fixture = new a_sqlite_database();
        await fixture.establish();
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.SQLite, database: fixture.database,
            readModels: [{ type: TaskRecord, table: fixture.table }] });
        const app = await builder.build();
        const scope = app.server.services.createScope({ tenantId: 'default', principal: undefined,
            allowedSeverity: Severity.Warning, signal: new AbortController().signal, correlationId: crypto.randomUUID() });
        try {
            const models = await scope.resolve(drizzleReadModel(TaskRecord));
            currentError = await models.observe().current().then(() => '', (error: Error) => error.message);
            subscriptionError = await new Promise<string>(resolve => models.observe().subscribe({
                error: (error: Error) => resolve(error.message)
            }));
        } finally { await scope.dispose(); await app.dispose(); fixture.close(); }
    });
    it('should reject the current snapshot with the named error', () => {
        currentError.should.equal('Drizzle observation is not enabled; set observation: DrizzleObservation.InProcess in withDrizzle');
    });
    it('should reject the subscription with the same error', () => {
        subscriptionError.should.equal('Drizzle observation is not enabled; set observation: DrizzleObservation.InProcess in withDrizzle');
    });
});

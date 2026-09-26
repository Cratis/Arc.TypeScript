// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, Severity } from '@cratis/arc.core';
import { DrizzleDialect } from '../../DrizzleDialect.js';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { drizzleDatabase, drizzleReadModel } from '../../drizzleToken.js';
import '../../index.js';
import { TaskRecord } from '../given/TaskRecord.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';
import { settle } from '../given/an_observation_scope.js';

describe('when a second tenant announces a SQL change', () => {
    let emissions: number[];
    let afterOtherTenant: number[];
    beforeEach(async () => {
        const own = new a_sqlite_database();
        const other = new a_sqlite_database();
        await own.establish(); await other.establish();
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.SQLite,
            databaseFactory: tenant => tenant === 'default' ? own.database : other.database,
            readModels: [{ type: TaskRecord, table: own.table }], observation: DrizzleObservation.InProcess });
        const app = await builder.build();
        const identity = (tenantId: string) => ({ tenantId, principal: undefined, allowedSeverity: Severity.Warning,
            signal: new AbortController().signal, correlationId: crypto.randomUUID() });
        const scope = app.server.services.createScope(identity('DeFaUlT'));
        const otherScope = app.server.services.createScope(identity('OTHER'));
        try {
            const models = await scope.resolve(drizzleReadModel(TaskRecord));
            emissions = [];
            const subscription = models.observe().subscribe(rows => emissions.push(rows.length));
            await settle();
            other.native.run("insert into tasks values ('31112233-4455-6677-8899-aabbccddeeff', 'other')");
            (await otherScope.resolve(drizzleDatabase())).notifyChanged(TaskRecord);
            await settle();
            afterOtherTenant = [...emissions];
            own.native.run("insert into tasks values ('31112233-4455-6677-8899-aabbccddeeff', 'ours')");
            (await scope.resolve(drizzleDatabase())).notifyChanged(TaskRecord);
            await settle();
            subscription.unsubscribe();
        } finally { await scope.dispose(); await otherScope.dispose(); await app.dispose(); own.close(); other.close(); }
    });
    it('should ignore the other tenant even with mixed-case IDs', () => { afterOtherTenant.should.deep.equal([2]); });
    it('should re-read the original tenant after its own change', () => { emissions.should.deep.equal([2, 3]); });
});

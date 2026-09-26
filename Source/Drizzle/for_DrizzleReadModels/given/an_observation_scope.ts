// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, Severity } from '@cratis/arc.core';
import { DrizzleDialect } from '../../DrizzleDialect.js';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import type { DrizzleHandle } from '../../DrizzleHandle.js';
import type { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { drizzleDatabase, drizzleReadModel } from '../../drizzleToken.js';
import '../../index.js';
import { a_sqlite_database } from './a_sqlite_database.js';
import { TaskRecord } from './TaskRecord.js';

export class an_observation_scope {
    fixture = new a_sqlite_database();
    app!: Awaited<ReturnType<ReturnType<typeof ArcApplication.createBuilder>['build']>>;
    scope!: ReturnType<typeof this.app.server.services.createScope>;
    models!: DrizzleReadModels<TaskRecord>;
    handle!: DrizzleHandle;
    async establish(maxPageSize?: number): Promise<void> {
        await this.fixture.establish();
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.SQLite, database: this.fixture.database,
            readModels: [{ type: TaskRecord, table: this.fixture.table }], observation: DrizzleObservation.InProcess,
            maxPageSize });
        this.app = await builder.build();
        this.scope = this.app.server.services.createScope({ tenantId: 'DeFaUlT', principal: undefined,
            allowedSeverity: Severity.Warning, signal: new AbortController().signal, correlationId: crypto.randomUUID() });
        this.models = await this.scope.resolve(drizzleReadModel(TaskRecord));
        this.handle = await this.scope.resolve(drizzleDatabase());
    }
    async dispose(): Promise<void> { await this.scope?.dispose(); await this.app?.dispose(); this.fixture.close(); }
}
export async function settle(): Promise<void> {
    for (let index = 0; index < 8; index++) await new Promise<void>(resolve => setImmediate(resolve));
}

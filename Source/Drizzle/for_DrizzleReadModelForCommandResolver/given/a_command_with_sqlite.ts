// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, Severity } from '@cratis/arc.core';
import { DrizzleDialect } from '../../DrizzleDialect.js';
import { a_sqlite_database } from '../../for_DrizzleReadModels/given/a_sqlite_database.js';
import { TaskRecord } from '../../for_DrizzleReadModels/given/TaskRecord.js';
import { RenameTask } from './RenameTask.js';
import '../../index.js';

/** Exercise command injection against real, tenant-bound in-process SQL. */
export class a_command_with_sqlite {
    readonly sqlite = new a_sqlite_database();
    application!: ArcApplication;
    async establish(other?: a_sqlite_database) {
        await this.sqlite.establish();
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.SQLite, databaseFactory: tenant => tenant === 'a' ? this.sqlite.database :
            other?.database ?? this.sqlite.database, readModels: [{ type: TaskRecord, table: this.sqlite.table }] });
        builder.add(RenameTask);
        this.application = await builder.build();
    }
    identity(tenantId = 'a') {
        return { tenantId, principal: undefined, allowedSeverity: Severity.Warning,
            signal: new AbortController().signal, correlationId: crypto.randomUUID() };
    }
    async close() { await this.application.dispose(); this.sqlite.close(); }
}

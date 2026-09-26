// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { command, inject, ArcApplication, Severity } from '@cratis/arc.core';
import { DrizzleDialect, DrizzleObservation, drizzleDatabase } from '../../index.js';
import type { DrizzleHandle } from '../../DrizzleHandle.js';
import { DrizzleChangeNotifications } from '../../DrizzleChangeNotifications.js';
import { a_sqlite_database } from '../../for_DrizzleReadModels/given/a_sqlite_database.js';
import { TaskRecord } from '../../for_DrizzleReadModels/given/TaskRecord.js';

should();
let table: a_sqlite_database['table'];
@command() class InnerNotification {
    @inject(drizzleDatabase())
    handle(handle: DrizzleHandle): void { handle.notifyChanged(table); }
}
@command() class FailingNotification {
    @inject(drizzleDatabase())
    handle(handle: DrizzleHandle): void { handle.notifyChanged(TaskRecord); throw Error('write failed later'); }
}
@command() class OuterNotification {
    @inject(drizzleDatabase())
    handle(handle: DrizzleHandle): void { handle.notifyChanged(TaskRecord); }
}

describe('when notifying from nested server commands', () => {
    it('should publish once after the outermost execution finishes', async () => {
        const fixture = new a_sqlite_database();
        await fixture.establish();
        table = fixture.table;
        const builder = ArcApplication.createBuilder();
        builder.withDrizzle({ dialect: DrizzleDialect.SQLite, database: fixture.database,
            readModels: [{ type: TaskRecord, table }], observation: DrizzleObservation.InProcess });
        let deliveries = 0;
        builder.addCommandExecutionRunner(async (context, execute) => {
            if (context.operationName?.endsWith('OuterNotification')) {
                const identity = { tenantId: context.tenantId, correlationId: context.correlationId,
                    principal: context.principal, allowedSeverity: context.allowedSeverity, signal: context.signal };
                const nested = await application.server.executeCommand('InnerNotification', {}, identity);
                nested.isSuccess.should.equal(true);
                deliveries.should.equal(0);
            }
            return execute();
        });
        builder.add(InnerNotification, OuterNotification, FailingNotification);
        const application = await builder.build();
        const scope = application.server.services.createScope({ tenantId: 'default', principal: undefined,
            allowedSeverity: Severity.Warning, correlationId: crypto.randomUUID(), signal: new AbortController().signal });
        try {
            const notifications = await scope.resolve(DrizzleChangeNotifications);
            const release = notifications.listen('default', table, () => { deliveries++; });
            const outcome = await application.server.executeCommand('OuterNotification', {}, {
                tenantId: 'DeFaUlT', principal: undefined, allowedSeverity: Severity.Warning,
                correlationId: crypto.randomUUID(), signal: new AbortController().signal });
            outcome.isSuccess.should.equal(true);
            deliveries.should.equal(1);
            const failed = await application.server.executeCommand('FailingNotification', {}, {
                tenantId: 'default', principal: undefined, allowedSeverity: Severity.Warning,
                correlationId: crypto.randomUUID(), signal: new AbortController().signal });
            failed.isSuccess.should.equal(false);
            deliveries.should.equal(2);
            release();
        } finally { await scope.dispose(); await application.dispose(); fixture.close(); }
    });
});

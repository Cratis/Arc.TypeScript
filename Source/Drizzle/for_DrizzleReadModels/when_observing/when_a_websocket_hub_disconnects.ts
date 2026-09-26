// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../../Core/ArcServer.js';
import { defineObservableQuery } from '../../../Core/queries/observable/defineObservableQuery.js';
import { HubConnection } from '../../../Core/queries/observable/HubConnection.js';
import { HubSubscriptionOutcome } from '../../../Core/queries/observable/HubSubscriptionOutcome.js';
import { Severity } from '../../../Core/validation/Severity.js';
import { DrizzleChangeNotifications } from '../../DrizzleChangeNotifications.js';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { TaskRecord } from '../given/TaskRecord.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';

describe('when a WebSocket hub disconnects from a SQL observation', () => {
    let before: number;
    let after: number;
    let outcome: HubSubscriptionOutcome;
    beforeEach(async () => {
        const fixture = new a_sqlite_database();
        await fixture.establish();
        const bus = new DrizzleChangeNotifications(new Map([[TaskRecord, fixture.table]]), true);
        const models = new DrizzleReadModels(fixture.database, fixture.table, TaskRecord, 100, undefined, bus, 'default');
        const server = new ArcServer({ observableQueries: [defineObservableQuery({ name: 'Tasks', schema: z.object({}),
            observe: () => models.observe() })] });
        const controller = new AbortController();
        const output = { signal: controller.signal, lastActivity: Date.now(), send: async () => {},
            close: () => controller.abort() };
        const connection = new HubConnection(server, 'WebSocket', output,
            { tenantId: 'default', signal: controller.signal, allowedSeverity: Severity.Warning,
                correlationId: crypto.randomUUID(), principal: undefined }, 0, () => {}, () => {});
        try {
            await connection.connect();
            outcome = await connection.subscribe('tasks', 1, { queryName: 'Tasks' });
            before = bus.listenerCount('default');
            await connection.close();
            after = bus.listenerCount('default');
        } finally { await connection.close(); await models[Symbol.asyncDispose](); await server.dispose(); fixture.close(); }
    });
    it('should admit the SQL stream', () => { outcome.should.equal(HubSubscriptionOutcome.Accepted); });
    it('should register one listener', () => { before.should.equal(1); });
    it('should release it on disconnect', () => { after.should.equal(0); });
});

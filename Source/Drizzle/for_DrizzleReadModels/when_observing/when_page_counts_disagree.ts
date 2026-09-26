// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DrizzleChangeNotifications } from '../../DrizzleChangeNotifications.js';
import type { DrizzleDatabase } from '../../DrizzleDatabase.js';
import { DrizzleReadModels } from '../../DrizzleReadModels.js';
import { TaskRecord } from '../given/TaskRecord.js';
import { a_sqlite_database } from '../given/a_sqlite_database.js';

describe('when the count and rows of an observed page keep disagreeing', () => {
    let error: string;
    let counts: number;
    let listeners: number;
    beforeEach(async () => {
        const fixture = new a_sqlite_database();
        await fixture.establish();
        counts = 0;
        const fake = { select: fixture.database.select.bind(fixture.database), $count: () => { counts++; return 3; } };
        const bus = new DrizzleChangeNotifications(new Map([[TaskRecord, fixture.table]]), true);
        const models = new DrizzleReadModels(fake as unknown as DrizzleDatabase, fixture.table, TaskRecord, 100,
            undefined, bus, 'default');
        try {
            error = await models.observePage(undefined, { paging: { page: 0, pageSize: 10 } })
                .current().then(() => '', (failure: Error) => failure.message);
            listeners = bus.listenerCount('default');
        } finally { await models[Symbol.asyncDispose](); fixture.close(); }
    });
    it('should retry no more than three times', () => { counts.should.equal(3); });
    it('should fail without emitting an inconsistent page', () => {
        error.should.equal('Drizzle observation could not read a consistent page');
    });
    it('should release the listener', () => { listeners.should.equal(0); });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleChangeNotifications } from '../../DrizzleChangeNotifications.js';
import { DrizzleObservable } from '../../DrizzleObservable.js';
import { DrizzleObservationSession } from '../../DrizzleObservationSession.js';

class Task {}
const table = sqliteTable('tasks', { id: text('id').primaryKey() });

describe('when a prime fails and is never adopted', () => {
    let error: string;
    let listeners: number;
    let idle: number;
    beforeEach(async () => {
        const bus = new DrizzleChangeNotifications(new Map([[Task, table]]), true);
        idle = 0;
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(
            () => Promise.reject(new Error('read failed')), changed => bus.listen('tenant', table, changed), undefined, closed),
        () => {}, () => {}, () => { idle++; });
        error = await observation.current().then(() => '', (reason: Error) => reason.message);
        listeners = bus.listenerCount('tenant');
        // Do not adopt or close: the failed prime must leave owner tracking on its own.
    });
    it('should retain the read failure for current', () => { error.should.equal('read failed'); });
    it('should release the listener', () => { listeners.should.equal(0); });
    it('should notify its owner when the failed prime terminates', () => { idle.should.equal(1); });
});

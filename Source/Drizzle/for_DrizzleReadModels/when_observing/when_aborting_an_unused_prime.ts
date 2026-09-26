// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleChangeNotifications } from '../../DrizzleChangeNotifications.js';
import { DrizzleObservable } from '../../DrizzleObservable.js';
import { DrizzleObservationSession } from '../../DrizzleObservationSession.js';

class Task {}
const table = sqliteTable('tasks', { id: text('id').primaryKey() });

describe('when aborting the signal of an unused prime', () => {
    let error: string;
    let listeners: number;
    let idle: number;
    beforeEach(async () => {
        const bus = new DrizzleChangeNotifications(new Map([[Task, table]]), true);
        const controller = new AbortController();
        idle = 0;
        const observable = new DrizzleObservable<number>(closed => new DrizzleObservationSession(
            () => new Promise<number>(() => {}), changed => bus.listen('tenant', table, changed), controller.signal, closed),
        () => {}, () => {}, () => { idle++; });
        const pending = observable.current().then(() => '', (reason: Error) => reason.message);
        controller.abort();
        error = await pending;
        listeners = bus.listenerCount('tenant');
        observable.close();
    });
    it('should reject the pending current read', () => { error.should.equal('Drizzle observation was closed'); });
    it('should release the listener', () => { listeners.should.equal(0); });
    it('should leave owner tracking', () => { idle.should.equal(1); });
});

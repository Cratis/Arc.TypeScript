// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleChangeNotifications } from '../../DrizzleChangeNotifications.js';
import { DrizzleObservable } from '../../DrizzleObservable.js';
import { DrizzleObservationSession } from '../../DrizzleObservationSession.js';

class Task {}
const table = sqliteTable('tasks', { id: text('id').primaryKey() });

describe('when a command publishes a change to a subscribed observer', () => {
    let readsWhenNotifyReturns: number;
    let contexts: (string | undefined)[];
    beforeEach(async () => {
        const commandContext = new AsyncLocalStorage<string>();
        const bus = new DrizzleChangeNotifications(new Map([[Task, table]]), true);
        contexts = [];
        let updated!: () => void;
        const reread = new Promise<void>(resolve => { updated = resolve; });
        const observable = new DrizzleObservable<number>(closed => new DrizzleObservationSession(async () => {
            contexts.push(commandContext.getStore());
            if (contexts.length === 2) updated();
            return contexts.length;
        }, changed => bus.listen('tenant', table, changed), undefined, closed), () => {});
        const subscription = observable.subscribe(() => {});
        await new Promise<void>(resolve => setImmediate(resolve));
        commandContext.run('command', () => {
            bus.notify('tenant', [Task]);
            readsWhenNotifyReturns = contexts.length;
        });
        await reread;
        subscription.unsubscribe();
        observable.close();
    });
    it('should return from notify before starting the observer reread', () => { readsWhenNotifyReturns.should.equal(1); });
    it('should not inherit the command async-local frame', () => { contexts.should.deep.equal([undefined, undefined]); });
});

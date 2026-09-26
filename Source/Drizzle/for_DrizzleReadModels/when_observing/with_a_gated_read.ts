// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleChangeNotifications } from '../../DrizzleChangeNotifications.js';
import { DrizzleObservable } from '../../DrizzleObservable.js';
import { DrizzleObservationSession } from '../../DrizzleObservationSession.js';

should();
const flush = async () => { for (let index = 0; index < 6; index++) await new Promise<void>(resolve => setImmediate(resolve)); };
const deferred = () => {
    let resolve!: (value: number) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<number>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

describe('when changes race a SQL observation read', () => {
    it('should read once more after a notification during the first read', async () => {
        const table = sqliteTable('items', { id: text('id').primaryKey() });
        class Item {}
        const bus = new DrizzleChangeNotifications(new Map([[Item, table]]), true);
        const first = deferred();
        let reads = 0;
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(() => {
            reads++;
            return reads === 1 ? first.promise : Promise.resolve(2);
        }, notify => bus.listen('tenant', table, notify), undefined, closed), () => {});
        const emissions: number[] = [];
        const subscription = observation.subscribe(value => emissions.push(value));
        bus.notify('tenant', [Item]);
        first.resolve(1);
        await flush();
        emissions.should.deep.equal([1, 2]);
        reads.should.equal(2);
        subscription.unsubscribe();
        bus.listenerCount('tenant').should.equal(0);
        observation.close();
    });

    it('should coalesce a burst during an in-flight reread without losing the last state', async () => {
        const table = sqliteTable('items', { id: text('id').primaryKey() });
        class Item {}
        const bus = new DrizzleChangeNotifications(new Map([[Item, table]]), true);
        const second = deferred();
        let reads = 0;
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(() => {
            reads++;
            return reads === 2 ? second.promise : Promise.resolve(reads);
        }, notify => bus.listen('tenant', table, notify), undefined, closed), () => {});
        const emissions: number[] = [];
        const subscription = observation.subscribe(value => emissions.push(value));
        await flush();
        bus.notify('tenant', [Item]);
        await flush();
        for (let index = 0; index < 100; index++) bus.notify('tenant', [Item]);
        reads.should.equal(2);
        second.resolve(2);
        await flush();
        emissions.should.deep.equal([1, 2, 3]);
        reads.should.equal(3);
        subscription.unsubscribe();
        observation.close();
    });

    it('should end on a read failure and release its listener without reopening', async () => {
        const table = sqliteTable('items', { id: text('id').primaryKey() });
        class Item {}
        const bus = new DrizzleChangeNotifications(new Map([[Item, table]]), true);
        let reads = 0;
        const failure = new Error('read failed');
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(() => {
            reads++;
            return reads === 1 ? Promise.resolve(1) : Promise.reject(failure);
        }, notify => bus.listen('tenant', table, notify), undefined, closed), () => {});
        let reported: unknown;
        observation.subscribe({ error: error => { reported = error; } });
        await flush();
        bus.notify('tenant', [Item]);
        await flush();
        (reported === failure).should.equal(true);
        bus.listenerCount('tenant').should.equal(0);
        bus.notify('tenant', [Item]);
        reads.should.equal(2);
    });

    it('should retain an initial read failure for adoption', async () => {
        const first = deferred();
        let signal!: () => void;
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(() => first.promise,
            changed => { signal = changed; return () => {}; }, undefined, closed), () => {});
        const current = observation.current().then(() => false, () => true);
        first.reject(new Error('database failed'));
        (await current).should.equal(true);
        const errors: string[] = [];
        observation.subscribe({ error: error => errors.push((error as Error).message) });
        await flush();
        errors.should.deep.equal(['database failed']);
        signal();
        observation.close();
    });

    it('should complete an adopter when a primed observation closes before subscription', async () => {
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(
            () => Promise.resolve(1), () => () => {}, undefined, closed), () => {});
        (await observation.current()).value.should.equal(1);
        observation.close();
        let completed = false;
        observation.subscribe({ complete: () => { completed = true; } });
        completed.should.equal(true);
    });

    it('should reject an outstanding current and suppress a late failure after closure', async () => {
        const first = deferred();
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(() => first.promise,
            () => () => {}, undefined, closed), () => {});
        const current = observation.current().then(() => false, () => true);
        observation.close();
        first.reject(new Error('late'));
        (await current).should.equal(true);
    });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { DrizzleObservable } from '../../DrizzleObservable.js';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { DrizzleObservationSession } from '../../DrizzleObservationSession.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';
import { database, deferred, Listener, table } from '../../for_PostgreSQLObservationManager/given/a_manager.js';

describe('when disposing a PostgreSQL manager with live observations', () => {
    it('should complete subscribers and settle an in-flight read without retrying forever', async () => {
        const listener = new Listener();
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => listener }, 60_000, 100, []);
        const read = deferred<number>();
        let reads = 0;
        let completed = 0;
        const values: number[] = [];
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(
            () => ++reads === 1 ? Promise.resolve(1) : read.promise,
            (changed, fail, complete) => manager.acquire('tenant', database, table, changed, fail, complete),
            undefined, closed), () => {});
        const subscription = observation.subscribe({ next: value => values.push(value), complete: () => { completed++; } });
        try {
            await vi.waitFor(() => values.should.deep.equal([1]));
            listener.notification?.('arc_changes', 'app.tasks');
            await vi.waitFor(() => reads.should.equal(2));
            await manager[Symbol.asyncDispose]();
            read.reject(new Error('reader pool closed'));
            await new Promise<void>(resolve => setTimeout(resolve, 10));
            completed.should.equal(1);
            reads.should.equal(2);
        } finally { read.resolve(2); subscription.unsubscribe(); observation.close(); await manager[Symbol.asyncDispose](); }
    });

    it('should complete subscriptions during recovery instead of erroring', async () => {
        const first = new Listener();
        const next = new Listener();
        const listen = deferred<void>();
        const query = next.query.bind(next);
        next.query = async statement => {
            if (statement.startsWith('LISTEN')) await listen.promise;
            return query(statement);
        };
        let calls = 0;
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => ++calls === 1 ? first : next }, 60_000, 100, [1]);
        const values: number[] = [];
        const errors: Error[] = [];
        let completed = 0;
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(
            async () => 1, (changed, fail, complete) => manager.acquire('tenant', database, table, changed, fail, complete),
            undefined, closed), () => {});
        const subscription = observation.subscribe({ next: value => values.push(value), error: error => errors.push(error),
            complete: () => { completed++; } });
        try {
            await vi.waitFor(() => values.should.deep.equal([1]));
            first.disconnect?.();
            await vi.waitFor(() => calls.should.equal(2));
            await manager[Symbol.asyncDispose]();
            completed.should.equal(1);
            errors.should.have.lengthOf(0);
        } finally { listen.resolve(); subscription.unsubscribe(); observation.close(); await manager[Symbol.asyncDispose](); }
    });
});

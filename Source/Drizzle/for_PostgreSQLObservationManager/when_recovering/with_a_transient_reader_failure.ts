// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import type { DrizzleDatabase } from '../../DrizzleDatabase.js';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';
import { Listener, row, table } from '../given/a_manager.js';

type Lookup = () => Promise<unknown>;
const readerWith = (failures: Lookup[]): DrizzleDatabase => {
    let lookups = 0;
    // The first lookup belongs to acquisition; later ones belong to recovery revalidation.
    return { execute: () => lookups++ === 0 ? Promise.resolve([row]) : (failures.shift() ?? (() => Promise.resolve([row])))() } as DrizzleDatabase;
};

describe('when a reader lookup fails transiently while a listener recovers', () => {
    for (const [kind, failure] of [
        ['rejects', () => Promise.reject(new Error('secret pool exhausted'))],
        ['times out', () => new Promise<unknown>(() => {})]
    ] as [string, Lookup][]) {
        it(`should spend a retry and recover when the lookup ${kind} once`, async () => {
            const listeners = [new Listener(), new Listener(), new Listener()];
            let connections = 0;
            const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
                listener: () => listeners[connections++]! }, 60_000, 20, [1, 1]);
            const updates: boolean[] = [];
            const failures: Error[] = [];
            const lease = manager.acquire('tenant', readerWith([failure]), table, forced => updates.push(forced ?? false), error => failures.push(error));
            try {
                await lease.ready;
                listeners[0]!.disconnect?.();
                await vi.waitFor(() => updates.should.deep.equal([true]));
                failures.should.have.lengthOf(0);
                connections.should.equal(3);
                listeners[1]!.closeCount.should.equal(1);
                listeners[2]!.notification?.('arc_changes', 'app.tasks');
                updates.should.deep.equal([true, false]);
            } finally { lease.release(); await manager[Symbol.asyncDispose](); }
        });
    }

    it('should error the lease with a sanitized cause when the lookup keeps failing', async () => {
        const listeners = [new Listener(), new Listener(), new Listener()];
        let connections = 0;
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => listeners[connections++]! }, 60_000, 20, [1, 1]);
        const failing: Lookup = () => Promise.reject(new Error('secret pool exhausted'));
        const failures: Error[] = [];
        const lease = manager.acquire('tenant', readerWith([failing, failing]), table, () => {}, error => failures.push(error));
        try {
            await lease.ready;
            listeners[0]!.disconnect?.();
            await vi.waitFor(() => failures.should.have.lengthOf(1));
            failures[0]!.message.should.equal("PostgreSQL change listener lost: connection closed (tenant 'tenant', recovery exhausted)");
            (failures[0]!.cause as Error).message.should.equal('PostgreSQL change listener lost: reader revalidation failure');
            failures[0]!.message.should.not.include('secret');
            (failures[0]!.cause as Error).message.should.not.include('secret');
            connections.should.equal(3);
        } finally { lease.release(); await manager[Symbol.asyncDispose](); }
    });
});

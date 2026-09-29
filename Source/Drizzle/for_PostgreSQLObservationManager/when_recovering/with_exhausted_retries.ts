// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { database, Listener, table } from '../given/a_manager.js';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';

describe('when PostgreSQL listener recovery exhausts its retry schedule', () => {
    it('should error every lease and allow a later subscription to start fresh', async () => {
        const first = new Listener();
        const fresh = new Listener();
        let calls = 0;
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => { calls++; if (calls === 1) return first; if (calls === 4) return fresh;
                throw new Error('secret connection string'); } }, 60_000, 100, [1, 2]);
        const errors: Error[] = [];
        const one = manager.acquire('tenant', database, table, () => {}, error => errors.push(error));
        const two = manager.acquire('tenant', database, table, () => {}, error => errors.push(error));
        try {
            await Promise.all([one.ready, two.ready]);
            first.disconnect?.(new Error('secret disconnect details'));
            await vi.waitFor(() => errors.should.have.lengthOf(2));
            errors[0]!.message.should.include("connection failure (tenant 'tenant', recovery exhausted)");
            errors[0]!.message.should.not.include('secret disconnect');
            errors[0]!.message.should.not.include('secret');
            calls.should.equal(3);
            const next = manager.acquire('tenant', database, table, () => {}, error => errors.push(error));
            await next.ready;
            calls.should.equal(4);
            next.release();
        } finally { one.release(); two.release(); await manager[Symbol.asyncDispose](); }
    });
});

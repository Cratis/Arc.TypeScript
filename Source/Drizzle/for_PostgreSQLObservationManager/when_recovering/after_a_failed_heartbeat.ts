// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import { PostgreSQLObservationManager } from '../../PostgreSQLObservationManager.js';
import { database, Listener, table } from '../given/a_manager.js';

describe('when a listener heartbeat fails and recovery is exhausted', () => {
    it('should retain the sanitized heartbeat reason', async () => {
        vi.useFakeTimers();
        const listener = new Listener();
        const query = listener.query.bind(listener);
        listener.query = statement => statement === 'SELECT 1' ? Promise.reject(new Error('secret host')) : query(statement);
        const manager = new PostgreSQLObservationManager({ mode: DrizzleObservation.PostgreSQLNotify,
            listener: () => listener }, 10, 100, []);
        const errors: Error[] = [];
        try {
            const lease = manager.acquire('tenant', database, table, () => {}, error => errors.push(error));
            await lease.ready;
            await vi.advanceTimersByTimeAsync(10);
            errors.should.have.lengthOf(1);
            errors[0]!.message.should.equal("PostgreSQL change listener lost: heartbeat failure (tenant 'tenant', recovery exhausted)");
            errors[0]!.message.should.not.include('secret host');
            (errors[0]!.cause as Error).message.should.equal('PostgreSQL change listener lost: heartbeat failure');
            lease.release();
            await manager[Symbol.asyncDispose]();
        } finally { vi.useRealTimers(); }
    });
});

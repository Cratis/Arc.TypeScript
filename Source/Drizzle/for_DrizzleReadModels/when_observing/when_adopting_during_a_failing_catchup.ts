// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { DrizzleObservable } from '../../DrizzleObservable.js';
import { DrizzleObservationSession } from '../../DrizzleObservationSession.js';
import { deferred } from './given/a_gated_observation.js';

describe('when a catch-up read fails during adoption', () => {
    it('should error the subscriber without starving the event loop', async () => {
        const catchup = deferred();
        let changed!: (catchup?: boolean) => void;
        let reads = 0;
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(
            () => ++reads === 1 ? Promise.resolve(1) : catchup.promise,
            notify => { changed = notify; return { ready: Promise.resolve(), whenReady: async () => 1,
                isCurrent: () => true, release: () => {} }; }, undefined, closed), () => {});
        try {
            (await observation.current()).value.should.equal(1);
            changed(true);
            const errors: Error[] = [];
            const subscription = observation.subscribe({ error: error => errors.push(error as Error) });
            await vi.waitFor(() => reads.should.equal(2));
            catchup.reject(new Error('catch-up failed'));
            await new Promise<void>(resolve => setImmediate(resolve));
            errors.map(error => error.message).should.deep.equal(['catch-up failed']);
            subscription.closed.should.equal(true);
        } finally { observation.close(); }
    });
});

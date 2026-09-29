// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { DrizzleObservable } from '../../DrizzleObservable.js';
import { DrizzleObservationSession } from '../../DrizzleObservationSession.js';
import { deferred } from './given/a_gated_observation.js';

describe('when a subscriber leaves during an adopted catch-up read', () => {
    it('should release the subscriber without starving the event loop', async () => {
        const catchup = deferred();
        let changed!: (catchup?: boolean) => void;
        let reads = 0;
        let releases = 0;
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(
            () => ++reads === 1 ? Promise.resolve(1) : catchup.promise,
            notify => { changed = notify; return { ready: Promise.resolve(), whenReady: async () => 1,
                isCurrent: () => true, release: () => { releases++; } }; }, undefined, closed), () => {});
        try {
            (await observation.current()).value.should.equal(1);
            changed(true);
            const subscription = observation.subscribe();
            await vi.waitFor(() => reads.should.equal(2));
            subscription.unsubscribe();
            catchup.resolve(2);
            await new Promise<void>(resolve => setImmediate(resolve));
            subscription.closed.should.equal(true);
            releases.should.equal(1);
        } finally { observation.close(); }
    });
    it('should complete an actively subscribed observer when its scope closes during catch-up', async () => {
        const catchup = deferred();
        let changed!: (catchup?: boolean) => void;
        let reads = 0;
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(
            () => ++reads === 1 ? Promise.resolve(1) : catchup.promise,
            notify => { changed = notify; return { ready: Promise.resolve(), whenReady: async () => 1,
                isCurrent: () => true, release: () => {} }; }, undefined, closed), () => {});
        try {
            await observation.current();
            changed(true);
            let completions = 0;
            const subscription = observation.subscribe({ complete: () => { completions++; } });
            await vi.waitFor(() => reads.should.equal(2));
            observation.close();
            catchup.resolve(2);
            await new Promise<void>(resolve => setImmediate(resolve));
            completions.should.equal(1);
            subscription.closed.should.equal(true);
        } finally { observation.close(); }
    });
});

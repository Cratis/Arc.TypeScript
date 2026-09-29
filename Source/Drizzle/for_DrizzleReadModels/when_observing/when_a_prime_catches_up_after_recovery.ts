// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { DrizzleObservable } from '../../DrizzleObservable.js';
import { DrizzleObservationSession } from '../../DrizzleObservationSession.js';

describe('when a PostgreSQL prime is unused during listener recovery', () => {
    it('should replace its retained snapshot before adoption', async () => {
        let changed!: (catchup?: boolean) => void;
        let generation = 1;
        let live = 1;
        let reads = 0;
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(
            async () => ++reads, (notify) => {
                changed = notify;
                return { ready: Promise.resolve(), whenReady: async () => live,
                    isCurrent: current => current === generation, release: () => {} };
            }, undefined, closed), () => {});
        try {
            (await observation.current()).value.should.equal(1);
            generation = 2; live = 2;
            changed(true);
            await vi.waitFor(() => reads.should.equal(2));
            const values: number[] = [];
            const subscription = observation.subscribe(value => values.push(value));
            await vi.waitFor(() => values.should.deep.equal([2]));
            subscription.unsubscribe();
        } finally { observation.close(); }
    });
});

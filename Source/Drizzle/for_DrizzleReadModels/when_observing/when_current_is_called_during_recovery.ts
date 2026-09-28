// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { DrizzleObservable } from '../../DrizzleObservable.js';
import { DrizzleObservationSession } from '../../DrizzleObservationSession.js';

describe('when current is called on a prime during PostgreSQL recovery', () => {
    it('should wait for the recovered connection and return its fresh snapshot', async () => {
        let changed!: (catchup?: boolean) => void;
        let ready = Promise.resolve(1);
        let resume!: (generation: number) => void;
        let generation = 1;
        let reads = 0;
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(
            async () => ++reads, notify => {
                changed = notify;
                return { ready: Promise.resolve(), whenReady: () => ready,
                    isCurrent: value => value === generation, release: () => {} };
            }, undefined, closed), () => {});
        try {
            (await observation.current()).value.should.equal(1);
            ready = new Promise<number>(resolve => { resume = resolve; });
            let settled = false;
            const result = observation.current().then(value => { settled = true; return value.value; });
            await Promise.resolve();
            settled.should.equal(false);
            generation = 2;
            changed(true);
            resume(2);
            (await result).should.equal(2);
            await vi.waitFor(() => reads.should.equal(2));
        } finally { observation.close(); }
    });
});

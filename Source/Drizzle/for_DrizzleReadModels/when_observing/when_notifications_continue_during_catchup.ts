// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { DrizzleObservable } from '../../DrizzleObservable.js';
import { DrizzleObservationSession } from '../../DrizzleObservationSession.js';

describe('when notifications continue during PostgreSQL catch-up', () => {
    for (const action of ['current', 'adopt'] as const) {
        it(`should let ${action} settle after the first catch-up read while the pump remains busy`, async () => {
            let changed!: (catchup?: boolean) => void;
            let reads = 0;
            const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(
                async () => {
                    reads++;
                    if (reads > 1) {
                        changed();
                        await new Promise<void>(resolve => setTimeout(resolve, 2));
                    }
                    return reads;
                }, notify => {
                    changed = notify;
                    return { ready: Promise.resolve(), whenReady: async () => 1,
                        isCurrent: () => true, release: () => {} };
                }, undefined, closed), () => {});
            try {
                (await observation.current()).value.should.equal(1);
                changed(true);
                if (action === 'current') {
                    (await observation.current()).value.should.equal(2);
                } else {
                    const values: number[] = [];
                    const subscription = observation.subscribe(value => values.push(value));
                    await vi.waitFor(() => values.includes(2).should.equal(true));
                    values[0]!.should.equal(2);
                    subscription.unsubscribe();
                }
                reads.should.be.greaterThan(1);
            } finally { observation.close(); }
        });
    }
});

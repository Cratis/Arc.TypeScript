// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { vi } from 'vitest';
import { DrizzleObservable } from '../../DrizzleObservable.js';
import { DrizzleObservationSession } from '../../DrizzleObservationSession.js';

describe('when a PostgreSQL read races listener recovery', () => {
    it('should discard the stale result and emit a fresh snapshot after recovery', async () => {
        let changed!: (catchup?: boolean) => void;
        let complete!: (value: number) => void;
        let resume!: (generation: number) => void;
        let ready = Promise.resolve(1);
        let generation = 1;
        let reads = 0;
        const observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(
            () => ++reads === 2 ? new Promise<number>(resolve => { complete = resolve; }) : Promise.resolve(reads),
            notify => {
                changed = notify;
                return { ready: Promise.resolve(), whenReady: () => ready,
                    isCurrent: value => value === generation, release: () => {} };
            }, undefined, closed), () => {});
        const values: number[] = [];
        const subscription = observation.subscribe(value => values.push(value));
        try {
            await vi.waitFor(() => values.should.deep.equal([1]));
            changed();
            await vi.waitFor(() => reads.should.equal(2));
            generation = 2;
            ready = new Promise<number>(resolve => { resume = resolve; });
            complete(99);
            await Promise.resolve();
            values.should.deep.equal([1]);
            changed(true);
            resume(2);
            await vi.waitFor(() => values.some(value => value >= 3).should.equal(true));
            values.should.not.include(99);
        } finally { subscription.unsubscribe(); observation.close(); }
    });
});

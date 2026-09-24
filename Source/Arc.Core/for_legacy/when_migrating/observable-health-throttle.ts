// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should, vi } from 'vitest';
import { CurrentValueSubject } from '../../index.js';
import { FilteredHealthSource } from '../../queries/observable/FilteredHealthSource.js';

should();

describe('caller-scoped health emissions', () => {
    it('should ignore other callers and coalesce a burst of own changes', async () => {
        vi.useFakeTimers();
        const changes = new CurrentValueSubject(0);
        let ownSubscriptions = 0;
        const source = new FilteredHealthSource(changes, () => ({
            connections: [], totalConnections: 0, totalSubscriptions: ownSubscriptions, querySubscriptions: []
        }));
        const received: number[] = [];
        const subscription = source.subscribe({ next: value => { received.push(value.totalSubscriptions); },
            error: () => {}, complete: () => {} });
        try {
            changes.next(1); // A different user's data does not change this caller's view.
            received.should.deep.equal([0]);
            for (let index = 0; index < 100; index++) {
                ownSubscriptions++;
                changes.next(index + 2);
            }
            received.should.deep.equal([0]);
            await vi.advanceTimersByTimeAsync(50);
            received.should.deep.equal([0, 100]);
        } finally { subscription.unsubscribe(); vi.useRealTimers(); }
    });
});

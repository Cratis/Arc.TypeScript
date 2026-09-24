// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import sinon from 'sinon';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { FilteredHealthSource } from '../FilteredHealthSource.js';

should();

describe('when receiving caller-scoped health changes', () => {
    let received: number[];
    let afterOtherCaller: number[];
    let beforeThrottle: number[];
    let subscription: { unsubscribe(): void };
    let clock: sinon.SinonFakeTimers;

    beforeEach(async () => {
        clock = sinon.useFakeTimers();
        const changes = new CurrentValueSubject(0);
        let ownSubscriptions = 0;
        const source = new FilteredHealthSource(changes, () => ({
            connections: [], totalConnections: 0, totalSubscriptions: ownSubscriptions, querySubscriptions: []
        }));
        received = [];
        subscription = source.subscribe({ next: value => { received.push(value.totalSubscriptions); },
            error: () => {}, complete: () => {} });
        changes.next(1);
        afterOtherCaller = [...received];
        for (let index = 0; index < 100; index++) {
            ownSubscriptions++;
            changes.next(index + 2);
        }
        beforeThrottle = [...received];
        await clock.tickAsync(50);
    });

    afterEach(() => { subscription.unsubscribe(); clock.restore(); });

    it('should ignore another caller without changing this view', () => { afterOtherCaller.should.deep.equal([0]); });
    it('should defer a burst of own changes', () => { beforeThrottle.should.deep.equal([0]); });
    it('should coalesce the burst into one update', () => { received.should.deep.equal([0, 100]); });
});

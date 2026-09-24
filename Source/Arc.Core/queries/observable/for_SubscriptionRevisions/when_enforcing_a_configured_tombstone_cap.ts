// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { SubscriptionRevisions } from '../SubscriptionRevisions.js';

should();

describe('when enforcing a configured tombstone cap', () => {
    let first: boolean;
    let second: boolean;
    let evicted: boolean;
    let retained: boolean;

    beforeEach(() => {
        const states = new SubscriptionRevisions(1);
        first = states.unsubscribe('old', 1);
        second = states.unsubscribe('recent', 1);
        evicted = states.subscribe('old', 1, 'evicted');
        retained = states.subscribe('recent', 1, 'retained');
    });

    it('should accept the first unsubscribe', () => { first.should.be.true; });
    it('should accept the second unsubscribe', () => { second.should.be.true; });
    it('should evict the oldest tombstone', () => { evicted.should.be.true; });
    it('should retain the most recent tombstone', () => { retained.should.be.false; });
});

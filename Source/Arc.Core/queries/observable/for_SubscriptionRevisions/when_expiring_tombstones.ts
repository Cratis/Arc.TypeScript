// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { SubscriptionRevisions } from '../SubscriptionRevisions.js';

should();

describe('when expiring tombstones', () => {
    let evicted: boolean;
    let retained: boolean;
    let expired: boolean;

    beforeEach(() => {
        const states = new SubscriptionRevisions();
        for (let index = 0; index < 1025; index++) states.unsubscribe(`q${index}`, 1, 100);
        evicted = states.subscribe('q0', 1, 'evicted', 101);
        retained = states.subscribe('q1', 1, 'retained', 101);
        expired = states.subscribe('q1', 1, 'expired', 100 + 120_000);
    });

    it('should evict the oldest past the default cap', () => { evicted.should.be.true; });
    it('should retain more recent tombstones', () => { retained.should.be.false; });
    it('should expire tombstones after two minutes', () => { expired.should.be.true; });
});

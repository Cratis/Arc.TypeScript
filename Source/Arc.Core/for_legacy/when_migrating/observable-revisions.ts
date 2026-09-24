// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { SubscriptionRevisions } from '../../queries/observable/SubscriptionRevisions.js';

should();

describe('observable subscription revisions', () => {
    it('should replace a legacy subscription only with a newer revision', () => {
        const states = new SubscriptionRevisions();
        states.subscribe('q', undefined, 'initial').should.equal(true);
        states.subscribe('q', undefined, 'initial').should.equal(false);
        states.subscribe('q', 1, 'replacement').should.equal(true);
        states.subscribe('q', undefined, 'legacy again').should.equal(false);
        states.subscribe('q', 1, 'duplicate').should.equal(false);
        states.subscribe('q', 0, 'invalid').should.equal(false);
        states.subscribe('q', 2, 'newer').should.equal(true);
        states.activeCount.should.equal(1);
    });

    it('should reject delayed subscribes at or below a prior unsubscribe', () => {
        const states = new SubscriptionRevisions();
        states.unsubscribe('q', 4, 100).should.equal(true);
        states.subscribe('q', 3, 'late', 101).should.equal(false);
        states.subscribe('q', 4, 'equal', 101).should.equal(false);
        states.subscribe('q', 5, 'new', 101).should.equal(true);
        states.unsubscribe('q', 4, 102).should.equal(false);
        states.isActive('q', 5).should.equal(true);
    });

    it('should expire tombstones after two minutes and evict oldest beyond 1024', () => {
        const states = new SubscriptionRevisions();
        for (let index = 0; index < 1025; index++) states.unsubscribe(`q${index}`, 1, 100);
        states.subscribe('q0', 1, 'evicted', 101).should.equal(true);
        states.subscribe('q1', 1, 'retained', 101).should.equal(false);
        states.subscribe('q1', 1, 'expired', 100 + 120_000).should.equal(true);
    });

    it('should honor a configured tombstone cap', () => {
        const states = new SubscriptionRevisions(1);
        states.unsubscribe('old', 1).should.equal(true);
        states.unsubscribe('recent', 1).should.equal(true);
        states.subscribe('old', 1, 'evicted').should.equal(true);
        states.subscribe('recent', 1, 'retained').should.equal(false);
    });

    it('should only accept positive safe-integer revisions', () => {
        for (const value of [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1', null])
            SubscriptionRevisions.valid(value).should.equal(false);
        SubscriptionRevisions.valid(1).should.equal(true);
    });
});

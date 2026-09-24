// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { SubscriptionRevisions } from '../SubscriptionRevisions.js';

should();

describe('when replacing a legacy subscription', () => {
    let results: boolean[];
    let count: number;

    beforeEach(() => {
        const states = new SubscriptionRevisions();
        results = [
            states.subscribe('q', undefined, 'initial'),
            states.subscribe('q', undefined, 'initial'),
            states.subscribe('q', 1, 'replacement'),
            states.subscribe('q', undefined, 'legacy again'),
            states.subscribe('q', 1, 'duplicate'),
            states.subscribe('q', 0, 'invalid'),
            states.subscribe('q', 2, 'newer')
        ];
        count = states.activeCount;
    });

    it('should accept the initial subscription', () => { results[0]?.should.be.true; });
    it('should reject another legacy subscription', () => { results[1]?.should.be.false; });
    it('should accept a newer numbered revision', () => { results[2]?.should.be.true; });
    it('should reject a legacy revision after a numbered one', () => { results[3]?.should.be.false; });
    it('should reject a duplicate revision', () => { results[4]?.should.be.false; });
    it('should reject an invalid revision', () => { results[5]?.should.be.false; });
    it('should accept a subsequent newer revision', () => { results[6]?.should.be.true; });
    it('should keep only one active subscription', () => { count.should.equal(1); });
});

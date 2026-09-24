// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { SubscriptionRevisions } from '../SubscriptionRevisions.js';

should();

describe('when subscribing after an unsubscribe', () => {
    let outcomes: boolean[];

    beforeEach(() => {
        const states = new SubscriptionRevisions();
        outcomes = [states.unsubscribe('q', 4, 100), states.subscribe('q', 3, 'late', 101),
            states.subscribe('q', 4, 'equal', 101), states.subscribe('q', 5, 'new', 101),
            states.unsubscribe('q', 4, 102), states.isActive('q', 5)];
    });

    it('should accept the unsubscribe', () => { outcomes[0]?.should.equal(true); });
    it('should reject an older delayed subscribe', () => { outcomes[1]?.should.equal(false); });
    it('should reject an equal delayed subscribe', () => { outcomes[2]?.should.equal(false); });
    it('should accept a newer subscribe', () => { outcomes[3]?.should.equal(true); });
    it('should reject an older unsubscribe', () => { outcomes[4]?.should.equal(false); });
    it('should preserve the newer subscription', () => { outcomes[5]?.should.equal(true); });
});

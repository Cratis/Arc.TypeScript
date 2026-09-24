// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { it, should } from 'vitest';
import { denied, isOutcome, rejected, response, validation } from '../../index.js';

should();

it('public isOutcome recognizes helper-branded outcomes, not similarly shaped application data', () => {
    const issues = [validation('blocked')];
    const businessRejection = rejected(...issues);
    (isOutcome(businessRejection)).should.equal(true);
    (isOutcome(denied())).should.equal(true);
    (isOutcome(response({ kind: 'validation' }))).should.equal(true);
    (isOutcome({ kind: 'validation', results: issues })).should.equal(false);
    (isOutcome({ kind: 'denied', reason: '' })).should.equal(false);
    (isOutcome({ kind: 'response', value: 1 })).should.equal(false);
    (isOutcome(null)).should.equal(false);
});

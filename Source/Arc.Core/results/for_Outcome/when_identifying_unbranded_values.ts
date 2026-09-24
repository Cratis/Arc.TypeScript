// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { isOutcome } from '../Outcome.js';
import { validation } from '../../validation/ValidationResult.js';

should();

describe('when identifying unbranded values', () => {
    let results: boolean[];

    beforeEach(() => {
        const issues = [validation('blocked')];
        results = [
            isOutcome({ kind: 'validation', results: issues }),
            isOutcome({ kind: 'denied', reason: '' }),
            isOutcome({ kind: 'response', value: 1 }),
            isOutcome(null)
        ];
    });

    it('should reject a validation-shaped value', () => results.should.have.property('0', false));
    it('should reject a denial-shaped value', () => results.should.have.property('1', false));
    it('should reject a response-shaped value', () => results.should.have.property('2', false));
    it('should reject null', () => results.should.have.property('3', false));
});

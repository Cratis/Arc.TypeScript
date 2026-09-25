// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { denied, isOutcome, rejected, response } from '../Outcome.js';
import { validation } from '../../validation/ValidationResult.js';

should();

describe('when identifying branded outcomes', () => {
    let results: boolean[];

    beforeEach(() => {
        results = [isOutcome(rejected(validation('blocked'))), isOutcome(denied()), isOutcome(response({ kind: 'validation' }))];
    });

    it('should recognize a rejected outcome', () => results.should.have.property('0', true));
    it('should recognize a denied outcome', () => results.should.have.property('1', true));
    it('should recognize a response outcome', () => results.should.have.property('2', true));
});

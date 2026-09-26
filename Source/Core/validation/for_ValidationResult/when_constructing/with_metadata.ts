// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import type { ValidationResult as ValidationResultType } from '../../ValidationResult.js';
import { ValidationResult } from '../../ValidationResult.js';
import { Severity } from '../../Severity.js';

should();
describe('when constructing validation results with metadata', () => {
    let results: ValidationResultType[];
    const state = { attempted: 3 };
    beforeEach(() => {
        const options = { members: ['name'], state, reason: 'constraintViolation', reasonDetail: 'UniqueName' };
        results = [ValidationResult.Information('Info', options), ValidationResult.Warning('Warning', options), ValidationResult.Error('Error', options)];
    });
    it('should use the chosen severity', () => results.map(value => value.severity).should.deep.equal([
        Severity.Information, Severity.Warning, Severity.Error
    ]));
    it('should retain the messages', () => results.map(value => value.message).should.deep.equal(['Info', 'Warning', 'Error']));
    it('should retain members', () => results.map(value => value.members).should.deep.equal([['name'], ['name'], ['name']]));
    it('should retain rule-author state', () => results.map(value => value.state).should.deep.equal([state, state, state]));
    it('should retain the reason', () => results.map(value => value.reason).should.deep.equal([
        'constraintViolation', 'constraintViolation', 'constraintViolation'
    ]));
    it('should retain the reason detail', () => results.map(value => value.reasonDetail).should.deep.equal([
        'UniqueName', 'UniqueName', 'UniqueName'
    ]));
});

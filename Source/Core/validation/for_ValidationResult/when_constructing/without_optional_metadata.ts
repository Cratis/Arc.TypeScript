// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ValidationResult } from '@cratis/arc.core';
import type { ValidationResult as ValidationResultType, ValidationResultOptions } from '@cratis/arc.core';
import { Severity } from '../../Severity.js';

should();
describe('when constructing validation results without optional metadata', () => {
    let results: ValidationResultType[];
    const options: ValidationResultOptions = {};
    beforeEach(() => {
        results = [ValidationResult.information('Info', options), ValidationResult.warning('Warning'), ValidationResult.error('Error')];
    });
    it('should use the chosen severity', () => results.map(value => value.severity).should.deep.equal([
        Severity.Information, Severity.Warning, Severity.Error
    ]));
    it('should default to an authored rule with no members', () => results.map(value => ({ members: value.members, reason: value.reason })).should.deep.equal([
        { members: [], reason: 'rule' }, { members: [], reason: 'rule' }, { members: [], reason: 'rule' }
    ]));
    it('should omit absent state', () => results.every(value => !Object.hasOwn(value, 'state')).should.be.true);
    it('should omit absent reason detail', () => results.every(value => !Object.hasOwn(value, 'reasonDetail')).should.be.true);
});

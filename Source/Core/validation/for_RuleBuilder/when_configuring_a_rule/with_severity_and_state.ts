// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';
import { Severity } from '../../Severity.js';

describe('when configuring severity and state on a rule', () => {
    let severity: Severity;
    let state: unknown;
    beforeEach(() => {
        const validator = new BaseValidator<{ value: string }>();
        validator.ruleFor(model => model.value).notEmpty().withSeverity(Severity.Warning).withState(model => model.value.length);
        const rule = validator.rules[0]!;
        severity = rule.severity;
        state = (rule.state as (model: { value: string }) => unknown)({ value: 'abc' });
    });
    it('should retain the specified severity', () => { severity.should.equal(Severity.Warning); });
    it('should compute the specified state', () => { (state as number).should.equal(3); });
});

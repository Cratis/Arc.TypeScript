// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';
import { evaluateRule } from '../../evaluateRule.js';

describe('when evaluating lessThan with higher number', () => {
    let result: boolean;
    beforeEach(async () => {
        const validator = new BaseValidator<{ value: number }>();
        validator.ruleFor(model => model.value).lessThan(3);
        result = await evaluateRule(validator.rules[0]!, 9, { value: 9 }, new AbortController().signal);
    });
    it('should reject the value', () => { result.should.equal(false); });
});

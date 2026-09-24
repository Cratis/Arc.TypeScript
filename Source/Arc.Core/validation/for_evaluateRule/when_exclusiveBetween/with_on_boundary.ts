// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';
import { evaluateRule } from '../../evaluateRule.js';

describe('when evaluating exclusiveBetween with on boundary', () => {
    let result: boolean;
    beforeEach(async () => {
        const validator = new BaseValidator<{ value: number }>();
        validator.ruleFor(model => model.value).exclusiveBetween(2, 4);
        result = await evaluateRule(validator.rules[0]!, 2, { value: 2 }, new AbortController().signal);
    });
    it('should reject the value', () => { result.should.equal(false); });
});

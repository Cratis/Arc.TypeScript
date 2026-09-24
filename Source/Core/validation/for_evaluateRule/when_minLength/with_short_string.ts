// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';
import { evaluateRule } from '../../evaluateRule.js';

describe('when evaluating minLength with short string', () => {
    let result: boolean;
    beforeEach(async () => {
        const validator = new BaseValidator<{ value: string }>();
        validator.ruleFor(model => model.value).minLength(2);
        result = await evaluateRule(validator.rules[0]!, 'a', { value: 'a' }, new AbortController().signal);
    });
    it('should reject the value', () => { result.should.equal(false); });
});

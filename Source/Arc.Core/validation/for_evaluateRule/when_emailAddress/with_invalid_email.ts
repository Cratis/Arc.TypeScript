// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';
import { evaluateRule } from '../../evaluateRule.js';

describe('when evaluating emailAddress with invalid email', () => {
    let result: boolean;
    beforeEach(async () => {
        const validator = new BaseValidator<{ value: string }>();
        validator.ruleFor(model => model.value).emailAddress();
        result = await evaluateRule(validator.rules[0]!, 'not-an-email', { value: 'not-an-email' }, new AbortController().signal);
    });
    it('should reject the value', () => { result.should.equal(false); });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';
import { evaluateRule } from '../../evaluateRule.js';

describe('when evaluating notNull with null', () => {
    let result: boolean;
    beforeEach(async () => {
        const validator = new BaseValidator<{ value: unknown }>();
        validator.ruleFor(model => model.value).notNull();
        result = await evaluateRule(validator.rules[0]!, null, { value: null }, new AbortController().signal);
    });
    it('should reject the value', () => { result.should.equal(false); });
});

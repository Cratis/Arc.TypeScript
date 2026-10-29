// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';
import { evaluateRule } from '../../evaluateRule.js';

describe('when evaluating notEmpty with next line character', () => {
    let result: boolean;
    beforeEach(async () => {
        const validator = new BaseValidator<{ value: unknown }>();
        validator.ruleFor(model => model.value).notEmpty();
        result = await evaluateRule(validator.rules[0]!, '\u0085', { value: '\u0085' }, new AbortController().signal);
    });
    it('should reject the value', () => { result.should.equal(false); });
});

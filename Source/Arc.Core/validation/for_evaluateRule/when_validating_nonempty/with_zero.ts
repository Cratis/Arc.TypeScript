// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';
import { evaluateRule } from '../../evaluateRule.js';

describe('when validating nonempty with zero', () => {
    let accepted: boolean;
    beforeEach(async () => {
        const validator = new BaseValidator<{ value: number }>();
        validator.ruleFor(model => model.value).notEmpty();
        accepted = await evaluateRule(validator.rules[0]!, 0, { value: 0 }, new AbortController().signal);
    });
    it('should reject the numeric default like FluentValidation', () => { accepted.should.equal(false); });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';
import { evaluateRule } from '../../evaluateRule.js';

describe('when evaluating notEmpty with padded content', () => {
    let result: boolean;
    beforeEach(async () => {
        const validator = new BaseValidator<{ value: unknown }>();
        validator.ruleFor(model => model.value).notEmpty();
        result = await evaluateRule(validator.rules[0]!, ' a ', { value: ' a ' }, new AbortController().signal);
    });
    it('should accept the value', () => { result.should.equal(true); });
});

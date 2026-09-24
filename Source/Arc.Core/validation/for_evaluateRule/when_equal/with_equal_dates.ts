// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';
import { evaluateRule } from '../../evaluateRule.js';

describe('when evaluating equal with equal dates', () => {
    let result: boolean;
    beforeEach(async () => {
        const validator = new BaseValidator<{ value: Date }>();
        validator.ruleFor(model => model.value).equal(new Date(1));
        result = await evaluateRule(validator.rules[0]!, new Date(1), { value: new Date(1) }, new AbortController().signal);
    });
    it('should accept the value', () => { result.should.equal(true); });
});

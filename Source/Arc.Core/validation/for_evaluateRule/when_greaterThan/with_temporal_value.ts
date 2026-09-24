// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DateOnly, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import { BaseValidator } from '../../BaseValidator.js';
import { evaluateRule } from '../../evaluateRule.js';

describe('when evaluating greaterThan with temporal values', () => {
    let results: boolean[];
    beforeEach(async () => {
        const pairs = [
            [DateOnly.parse('2025-01-03'), DateOnly.parse('2025-01-02')],
            [TimeOnly.parse('11:22:34'), TimeOnly.parse('11:22:33')],
            [TimeSpan.parse('01:02:04'), TimeSpan.parse('01:02:03')],
            [new Date('2025-01-03'), new Date('2025-01-02')]
        ];
        results = [];
        for (const [value, comparison] of pairs) {
            const validator = new BaseValidator<{ value: Date }>();
            validator.ruleFor(model => model.value).greaterThan(comparison as Date);
            results.push(await evaluateRule(validator.rules[0]!, value, { value }, new AbortController().signal));
        }
    });
    it('should order temporal values by value', () => { results.should.deep.equal([true, true, true, true]); });
});

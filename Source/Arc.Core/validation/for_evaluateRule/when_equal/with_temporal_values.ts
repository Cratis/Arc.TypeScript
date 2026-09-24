// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DateOnly, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import { BaseValidator } from '../../BaseValidator.js';
import { evaluateRule } from '../../evaluateRule.js';

describe('when evaluating equal with temporal values and GUIDs', () => {
    let results: boolean[];
    beforeEach(async () => {
        const pairs = [
            [Guid.parse('11111111-1111-4111-8111-111111111111'), Guid.parse('11111111-1111-4111-8111-111111111111')],
            [DateOnly.parse('2025-01-02'), DateOnly.parse('2025-01-02')],
            [TimeOnly.parse('11:22:33'), TimeOnly.parse('11:22:33')],
            [TimeSpan.parse('01:02:03'), TimeSpan.parse('01:02:03')],
            [new Date('2025-01-02'), new Date('2025-01-02')]
        ];
        results = [];
        for (const [value, comparison] of pairs) {
            const validator = new BaseValidator<{ value: unknown }>();
            validator.ruleFor(model => model.value).equal(comparison);
            results.push(await evaluateRule(validator.rules[0]!, value, { value }, new AbortController().signal));
        }
    });
    it('should compare all value types by value', () => { results.should.deep.equal([true, true, true, true, true]); });
});

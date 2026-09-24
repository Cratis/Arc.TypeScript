// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';

describe('when applying unless to a rule chain', () => {
    let results: boolean[];
    beforeEach(async () => {
        const validator = new BaseValidator<{ title: string }>();
        validator.ruleFor(input => input.title).notEmpty().minLength(5).unless(input => input.title === 'disabled');
        results = await Promise.all(validator.rules.map(rule => rule.condition!({ title: 'disabled' })));
    });
    it('should invert the predicate for every rule', () => { results.should.deep.equal([false, false]); });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';

interface Input { title: string; }
describe('when applying a condition to a rule chain', () => {
    let results: boolean[];
    beforeEach(async () => {
        const validator = new BaseValidator<Input>();
        validator.ruleFor(input => input.title).notEmpty().minLength(5).when(input => input.title === 'enabled');
        results = await Promise.all(validator.rules.map(rule => rule.condition!({ title: 'disabled' })));
    });
    it('should apply the condition to every rule by default', () => { results.should.deep.equal([false, false]); });
});

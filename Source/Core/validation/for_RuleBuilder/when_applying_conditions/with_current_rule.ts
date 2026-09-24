// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ApplyConditionTo } from '../../ApplyConditionTo.js';
import { BaseValidator } from '../../BaseValidator.js';

describe('when applying a condition to only the current rule', () => {
    let applicable: boolean;
    let originalHasCondition: boolean;
    beforeEach(async () => {
        const validator = new BaseValidator<{ title: string }>();
        validator.ruleFor(input => input.title).notEmpty().minLength(5)
            .when(input => input.title === 'enabled', ApplyConditionTo.CurrentValidator);
        originalHasCondition = validator.rules[0]!.condition !== undefined;
        applicable = await validator.rules[1]!.condition!({ title: 'disabled' });
    });
    it('should leave the previous rule unconditional', () => { originalHasCondition.should.equal(false); });
    it('should condition the latest rule', () => { applicable.should.equal(false); });
});

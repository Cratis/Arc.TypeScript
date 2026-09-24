// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';

describe('when classifying rules with a condition', () => {
    let validator: BaseValidator<{ title: string }>;
    beforeEach(() => {
        validator = new BaseValidator<{ title: string }>();
        validator.ruleFor(input => input.title).notEmpty().withMessage('Required').when(input => input.title.length < 4);
    });
    it('should keep the rule server only', () => { validator.rules[0]!.clientSafe.should.equal(false); });
    it('should freeze the recorded declaration', () => { Object.isFrozen(validator.rules[0]).should.equal(true); });
    it('should retain the selected member', () => { validator.rules[0]!.path.should.deep.equal(['title']); });
});

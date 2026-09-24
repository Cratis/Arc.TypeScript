// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';

describe('when configuring a between rule with reversed dates', () => {
    let failure: Error;
    beforeEach(() => {
        const validator = new BaseValidator<{ date: Date }>();
        try {
            validator.ruleFor(model => model.date).inclusiveBetween(new Date('2025-01-01'), new Date('2024-01-01'));
        } catch (error) { failure = error as Error; }
    });
    it('should reject inverted temporal bounds', () => {
        failure.message.should.equal('Invalid validation rule arguments: inclusiveBetween');
    });
});

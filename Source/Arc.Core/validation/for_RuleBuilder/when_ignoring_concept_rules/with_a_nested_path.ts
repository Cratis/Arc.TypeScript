// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BaseValidator } from '../../BaseValidator.js';

describe('when ignoring concept rules on a nested path', () => {
    let failure: Error;
    beforeEach(() => {
        try {
            new BaseValidator<{ inner: { title: string } }>().ruleFor(model => model.inner.title).notEmpty().ignoreConceptRules();
        } catch (error) { failure = error as Error; }
    });
    it('should reject ignoring a descendant concept', () => {
        failure.message.should.equal('Only direct concept members can ignore concept rules');
    });
});

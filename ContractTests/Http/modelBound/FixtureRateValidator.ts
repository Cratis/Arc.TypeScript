// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptValidator, validator } from '@cratis/arc.core';
import { FixtureRate } from './FixtureRate.js';
@validator(FixtureRate)
export class FixtureRateValidator extends ConceptValidator<FixtureRate> {
    constructor() {
        super();
        this.ruleFor(rate => rate.value).greaterThan(0).withMessage('Rate must be positive');
    }
}

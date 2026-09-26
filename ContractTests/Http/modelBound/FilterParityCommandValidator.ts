// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandValidator, validator } from '@cratis/arc.core';
import { FilterParityCommand } from './FilterParityCommand.js';
import { recordFilterParity } from './FilterParityObservations.js';

/** Reject the fixture's invalid values. */
@validator(FilterParityCommand)
export class FilterParityCommandValidator extends CommandValidator<FilterParityCommand> {
    constructor() {
        super();
        recordFilterParity('command validator constructed');
        this.ruleFor(command => command.value).must(value => {
            recordFilterParity('command validator', value);
            return !value.endsWith('invalid');
        }).withMessage('Value is invalid');
    }
}

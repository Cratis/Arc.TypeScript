// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandValidator, validator } from '@cratis/arc.core';
import { FilterParityCommand } from './FilterParityCommand.js';

/** Reject the fixture's invalid values. */
@validator(FilterParityCommand)
export class FilterParityCommandValidator extends CommandValidator<FilterParityCommand> {
    constructor() {
        super();
        this.ruleFor(command => command.value).must(value => !value.endsWith('invalid')).withMessage('Value is invalid');
    }
}

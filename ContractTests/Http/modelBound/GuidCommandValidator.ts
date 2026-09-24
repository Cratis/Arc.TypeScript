// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandValidator, validator } from '@cratis/arc.core';
import { GuidCommand } from './GuidCommand.js';

@validator(GuidCommand)
export class GuidCommandValidator extends CommandValidator<GuidCommand> {
    constructor() {
        super();
        this.ruleFor(command => command.id).notEmpty().withMessage('Id required');
    }
}

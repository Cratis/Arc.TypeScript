// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandValidator, validator } from '@cratis/arc.core';
import { RegisterTask } from './RegisterTask.js';

@validator(RegisterTask)
export class RegisterTaskValidator extends CommandValidator<RegisterTask> {
    constructor() {
        super();
        this.ruleFor(command => command.title).notEmpty().withMessage('A title is required');
        this.ruleFor(command => command.title).maxLength(100).withMessage('A title can have at most 100 characters');
    }
}

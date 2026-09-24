// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandValidator, Severity, validator } from '@cratis/arc.core';
import { ModelBoundCommand } from './ModelBoundCommand.js';

@validator(ModelBoundCommand)
export class ModelBoundCommandValidator extends CommandValidator<ModelBoundCommand> {
    constructor() {
        super();
        this.ruleFor(command => command.title).notEmpty().withMessage('Title required').withState('title-owned');
        this.ruleFor(command => command.title).minLength(5).withMessage('Consider a longer title').withSeverity(Severity.Warning);
    }
}

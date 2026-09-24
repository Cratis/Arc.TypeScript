// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandValidator, injectable, validator } from '@cratis/arc.core';
import { Authors } from '../Authors.js';
import { RegisterAuthor } from './RegisterAuthor.js';

@validator(RegisterAuthor)
@injectable(Authors)
export class RegisterAuthorValidator extends CommandValidator<RegisterAuthor> {
    constructor(authors: Authors) {
        super();
        this.ruleFor(command => command.name)
            .mustAsync(async (_name, command) => !await authors.existsByName(command.name))
            .withMessage('An author with that name is already registered');
    }
}

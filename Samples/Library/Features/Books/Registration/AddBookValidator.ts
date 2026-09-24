// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandValidator, validator } from '@cratis/arc.core';
import { AddBook } from './AddBook.js';

@validator(AddBook)
export class AddBookValidator extends CommandValidator<AddBook> {
    constructor() {
        super();
        this.ruleFor(command => command.title).notEmpty().withMessage('A title is required');
    }
}

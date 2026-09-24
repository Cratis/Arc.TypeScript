// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptValidator, validator } from '@cratis/arc.core';
import { BookTitle } from './BookTitle.js';

@validator(BookTitle)
export class BookTitleValidator extends ConceptValidator<BookTitle> {
    constructor() {
        super();
        this.ruleFor(title => title.value).notEmpty().withMessage('A book title is required');
        this.ruleFor(title => title.value).maxLength(200).withMessage('A book title cannot exceed 200 characters');
    }
}

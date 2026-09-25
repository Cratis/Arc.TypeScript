// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs } from '@cratis/fundamentals';
import { ConceptValidator, validator } from '@cratis/arc.core';

export class AuthorName extends ConceptAs<string> { static readonly valueType = String; }

@validator(AuthorName)
export class AuthorNameValidator extends ConceptValidator<AuthorName> {
    constructor() {
        super();
        this.ruleFor(name => name.value).notEmpty().withMessage('An author name is required');
        this.ruleFor(name => name.value).maxLength(100).withMessage('An author name cannot exceed 100 characters');
    }
}

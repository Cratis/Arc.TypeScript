// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptValidator } from '../../ConceptValidator.js';
import { validator } from '../../validator.js';
import { Name } from './Name.js';
@validator(Name)
export class ThrowingNameValidator extends ConceptValidator<Name> {
    constructor() {
        super();
        this.ruleFor(name => name.value).notEmpty().withMessage('Should be discarded');
        this.ruleFor(name => name.value).must(() => { throw new Error('secret'); });
    }
}

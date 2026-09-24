// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ModelValidator } from '../../validation/ModelValidator.js';
import { validator } from '../../validation/validator.js';
import { Entry } from './Entry.js';
@validator(Entry)
export class EntryValidator extends ModelValidator<Entry> {
    constructor() {
        super();
        this.ruleFor(entry => entry.name).notNull().ignoreConceptRules();
    }
}

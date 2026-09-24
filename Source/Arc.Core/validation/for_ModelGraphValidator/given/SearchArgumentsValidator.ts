// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { QueryValidator } from '../../QueryValidator.js';
import { validator } from '../../validator.js';
import { SearchArguments } from './SearchArguments.js';
@validator(SearchArguments)
export class SearchArgumentsValidator extends QueryValidator<SearchArguments> {
    constructor() {
        super();
        this.ruleFor(arguments_ => arguments_.term).notEmpty().withMessage('Term required');
    }
}

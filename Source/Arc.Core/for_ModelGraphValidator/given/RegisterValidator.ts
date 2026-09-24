// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandValidator } from '../../validation/CommandValidator.js';
import { validator } from '../../validation/validator.js';
import { Register } from './Register.js';
@validator(Register)
export class RegisterValidator extends CommandValidator<Register> {
    constructor() {
        super();
        this.ruleFor(model => model.entries).must(entries => entries.length > 0).withMessage('Entries required');
    }
}

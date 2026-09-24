// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { injectable } from '../../../modelBound/decorators.js';
import { ConceptValidator } from '../../ConceptValidator.js';
import { validator } from '../../validator.js';
import { Name } from './Name.js';
import { Policy } from './Policy.js';

@validator(Name)
@injectable(Policy)
export class AsyncNameValidator extends ConceptValidator<Name> {
    constructor(policy: Policy) {
        super();
        this.ruleFor(name => name.value).mustAsync((value, _model, signal) => policy.accepts(value, signal))
            .withMessage('Policy denied');
    }
}

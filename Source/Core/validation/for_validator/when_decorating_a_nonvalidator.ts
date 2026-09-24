// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { validator } from '../validator.js';
import { given } from '../../given.js';
import { a_validator_target } from './given/a_validator_target.js';

class Unrelated {}

describe('when decorating a class that is not a model validator', given(a_validator_target, context => {
    let error: unknown;
    beforeEach(() => {
        const unchecked = validator(context.type) as unknown as (type: typeof Unrelated) => void;
        try { unchecked(Unrelated); }
        catch (failure) { error = failure; }
    });
    it('should reject the misplaced validator declaration', () => {
        (error as Error).message.should.contain('must extend BaseValidator');
    });
}));

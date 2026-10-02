// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readModelForValidation } from '../../readModelForValidation.js';
import { State } from '../given/a_command_with_validation_state.js';

describe('when resolving without a command validation context', () => {
    let error: unknown;
    beforeEach(async () => {
        try { await readModelForValidation(State); }
        catch (caught) { error = caught; }
    });
    it('should throw a clear error', () => {
        (error as Error).should.be.instanceOf(Error);
        (error as Error).message.should.equal('Command read models can only be resolved during command validation');
    });
});

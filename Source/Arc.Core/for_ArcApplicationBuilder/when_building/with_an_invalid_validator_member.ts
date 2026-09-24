// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, validator } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@command()
class Register { @field(String) title!: string; handle(): void {} }
@validator(Register)
class InvalidValidator extends CommandValidator<Register> {
    constructor() {
        super();
        this.ruleFor(model => (model as Register & { missing: string }).missing).notEmpty();
    }
}
describe('when building with an invalid validator member', given(an_application_builder, context => {
    let failure: Error;
    beforeEach(async () => {
        const builder = context.create();
        builder.add(Register, InvalidValidator);
        try { await builder.build(); } catch (error) { failure = error as Error; }
    });
    it('should reject the selector before serving requests', () => {
        (failure.cause as Error).message.should.equal('Invalid validation member: missing');
    });
}));

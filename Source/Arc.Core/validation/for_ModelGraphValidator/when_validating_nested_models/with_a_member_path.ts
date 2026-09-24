// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, validator } from '../../../index.js';
import { given } from '../../../given.js';
import { an_application_builder } from '../../../for_ArcApplicationBuilder/given/an_application_builder.js';
import { ModelValidator } from '../../ModelValidator.js';

class Inner { @field(String) streetName!: string; }
@command()
class RegisterAddress { @field(Inner) inner!: Inner; handle(): void {} }
@validator(Inner)
class InnerValidator extends ModelValidator<Inner> {
    constructor() { super(); this.ruleFor(model => model.streetName).notEmpty().withMessage('Street required'); }
}
describe('when validating a nested model with a member path', given(an_application_builder, context => {
    let members: string[];
    beforeEach(async () => {
        const builder = context.create();
        builder.add(RegisterAddress, InnerValidator);
        const application = await builder.build();
        const response = await application.server.handle(new Request('http://localhost/api/register-address/validate', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"inner":{"streetName":""}}'
        }));
        const result = await response!.json() as { validationResults: { members: string[] }[] };
        members = result.validationResults[0]!.members;
        await application.dispose();
    });
    it('should report the full nested member path', () => { members.should.deep.equal(['inner.streetName']); });
}));

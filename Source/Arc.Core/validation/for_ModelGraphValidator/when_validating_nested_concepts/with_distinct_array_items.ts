// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { an_application_builder } from '../../../for_ArcApplicationBuilder/given/an_application_builder.js';
import { NameValidator } from '../given/NameValidator.js';
import { Register } from '../given/Register.js';
import { RegisterValidator } from '../given/RegisterValidator.js';

describe('when validating nested concepts with distinct array items', given(an_application_builder, context => {
    let result: { validationResults: { members: string[]; message: string; reason: string }[] };
    beforeEach(async () => {
        const builder = context.create({ development: true });
        builder.add(Register, RegisterValidator, NameValidator);
        const application = await builder.build();
        const response = await application.server.handle(new Request('http://localhost/api/register', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ entries: [{ name: '' }, { name: '' }] })
        }));
        result = await response!.json();
        await application.dispose();
    });
    it('should report each concept at its collection path', () => {
        result.validationResults.map(issue => issue.members).should.deep.equal([['entries.name'], ['entries.name']]);
    });
    it('should preserve the authored failure reason', () => {
        result.validationResults.map(issue => issue.reason).should.deep.equal(['rule', 'rule']);
    });
}));

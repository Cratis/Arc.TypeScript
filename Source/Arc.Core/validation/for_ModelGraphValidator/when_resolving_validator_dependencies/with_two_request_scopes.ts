// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { an_application_builder } from '../../../for_ArcApplicationBuilder/given/an_application_builder.js';
import { AsyncNameValidator } from '../given/AsyncNameValidator.js';
import { Policy } from '../given/Policy.js';
import { Register } from '../given/Register.js';

describe('when resolving validator dependencies with two request scopes', given(an_application_builder, context => {
    let instances: Policy[];
    beforeEach(async () => {
        instances = [];
        const builder = context.create({ development: true });
        builder.services.addScoped(Policy, () => {
            const policy = new Policy(async () => true);
            instances.push(policy);
            return policy;
        });
        builder.add(Register, AsyncNameValidator);
        const application = await builder.build();
        for (const name of ['Ada', 'Grace']) await application.server.handle(new Request('http://localhost/api/register/validate', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entries: [{ name }] })
        }));
        await application.dispose();
    });
    it('should construct one dependency during build and one per request', () => { instances.should.have.lengthOf(3); });
    it('should not reuse a dependency between requests', () => { (instances[1] === instances[2]).should.equal(false); });
}));

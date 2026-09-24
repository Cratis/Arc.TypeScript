// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../ArcApplication.js';
import { AsyncNameValidator } from '../given/AsyncNameValidator.js';
import { Policy } from '../given/Policy.js';
import { Register } from '../given/Register.js';

describe('when resolving validator dependencies with two request scopes', () => {
    let instances: Policy[];
    beforeEach(async () => {
        instances = [];
        const builder = ArcApplication.createBuilder({ development: true });
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
    it('should construct one dependency in each request scope', () => { instances.should.have.lengthOf(2); });
    it('should not reuse a dependency between requests', () => { (instances[0] === instances[1]).should.equal(false); });
});

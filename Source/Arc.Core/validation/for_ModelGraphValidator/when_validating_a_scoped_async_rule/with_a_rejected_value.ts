// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import sinon from 'sinon';
import { ArcApplication } from '../../../ArcApplication.js';
import { given } from '../../../given.js';
import { AsyncNameValidator } from '../given/AsyncNameValidator.js';
import { Policy } from '../given/Policy.js';
import { Register } from '../given/Register.js';

class a_policy {
    readonly accepts = sinon.stub<[string, AbortSignal], Promise<boolean>>().resolves(false);
}
describe('when validating a scoped async rule with a rejected value', given(a_policy, context => {
    let result: { validationResults: { members: string[]; message: string }[] };
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder({ development: true });
        builder.services.addScoped(Policy, () => new Policy(context.accepts));
        builder.add(Register, AsyncNameValidator);
        const application = await builder.build();
        const response = await application.server.handle(new Request('http://localhost/api/register/validate', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entries: [{ name: 'Ada' }] })
        }));
        result = await response!.json();
        await application.dispose();
    });
    it('should attribute the failure to the concept member', () => {
        result.validationResults.map(issue => issue.members).should.deep.equal([['entries.name']]);
    });
    it('should pass the name and request signal to the policy', () => {
        context.accepts.firstCall.args[0].should.equal('Ada');
        context.accepts.firstCall.args[1].should.be.instanceOf(AbortSignal);
    });
}));

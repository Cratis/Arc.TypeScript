// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AuthenticationStatus, query, readModel, roles } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@readModel()
@roles('Admin')
export class ProtectedLookup {
    @roles('Reader')
    @query()
    static Get(): string { return 'private'; }
}

describe('when a read model and its method both declare roles', given(an_application_builder, context => {
    let result: Response;
    beforeEach(async () => {
        const builder = context.create({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
            principal: { id: 'reader', roles: ['Reader'], isAuthenticated: true } })] });
        builder.add(ProtectedLookup);
        const application = await builder.build();
        try { result = (await application.server.handle(new Request('http://localhost/api/get')))!; }
        finally { await application.dispose(); }
    });
    it('should permit the method role instead of requiring the class role', () => { result.status.should.equal(200); });
}));

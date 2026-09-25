// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AuthenticationStatus } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';
import { ProtectedLookup } from './with_class_and_method_roles.js';

describe('when a query method replaces the class role', given(an_application_builder, context => {
    let result: Response;
    beforeEach(async () => {
        const builder = context.create({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
            principal: { id: 'admin', roles: ['Admin'], isAuthenticated: true } })] });
        builder.add(ProtectedLookup);
        const application = await builder.build();
        try { result = (await application.server.handle(new Request('http://localhost/api/get')))!; }
        finally { await application.dispose(); }
    });
    it('should deny a caller with only the class role', () => { result.status.should.equal(403); });
}));

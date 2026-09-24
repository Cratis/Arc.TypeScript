// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readModel, query, authorize, AuthenticationStatus } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@authorize('Readers')
@readModel()
class Reports {
    @query()
    static latest(): string { return 'latest'; }

    @authorize('Auditors')
    @query()
    static audit(): string { return 'audit'; }
}

describe('when a query method replaces the read model policy', given(an_application_builder, context => {
    let latest: Response;
    let audit: Response;
    beforeEach(async () => {
        const builder = context.create({ authentication: [request => ({ status: AuthenticationStatus.Authenticated,
            principal: { id: 'alice', roles: [request.headers.get('role') ?? 'Reader'], isAuthenticated: true } })] });
        builder.add(Reports).addAuthorizationPolicy('Readers', principal => principal.roles.includes('Reader'))
            .addAuthorizationPolicy('Auditors', principal => principal.roles.includes('Auditor'));
        const app = await builder.build();
        try {
            latest = (await app.server.handle(new Request('http://localhost/api/latest')))!;
            audit = (await app.server.handle(new Request('http://localhost/api/audit', { headers: { role: 'Auditor' } })))!;
        } finally { await app.dispose(); }
    });
    it('should evaluate the class policy on an undecorated method', () => { latest.status.should.equal(200); });
    it('should evaluate the method policy instead of the class policy', () => { audit.status.should.equal(200); });
}));

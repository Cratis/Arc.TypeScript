// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer, AuthenticationStatus } from '@cratis/arc.core';
import { hosts, socket, startHost } from './given/a_real_identity_host.js';

for (const host of hosts) for (const [role, status] of [[undefined, 401], ['Reader', 403], ['Admin', 200]] as const) {
    describe(`when ${host} serves discovery to ${role ?? 'anonymous'} outside Development`, () => {
        let statuses: number[];
        beforeEach(async () => {
            const server = new ArcServer({ environmentName: 'Production', introspection: { roles: 'Admin' },
                authentication: [request => {
                    const authorization = request.headers.get('Authorization');
                    return authorization ? { status: AuthenticationStatus.Authenticated,
                        principal: { id: 'reader', roles: [authorization], isAuthenticated: true } } : { status: AuthenticationStatus.Anonymous };
                }] });
            const listener = await startHost(host, server);
            try {
                statuses = await Promise.all(['/.cratis/commands', '/.cratis/queries', '/.cratis/identity-details/schema',
                    '/.cratis/users', '/.cratis/tenants', '/openapi.json'].map(async path =>
                    (await socket(listener.port, false, path, role ? { Authorization: role } : {})).status));
            } finally { await listener.close(); }
        });
        it('should apply the shared discovery policy to all routes', () => statuses.should.deep.equal(Array(6).fill(status)));
    });
}

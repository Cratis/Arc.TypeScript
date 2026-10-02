// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer } from '../../ArcServer.js';
import { a_discovery_host } from '../given/a_discovery_host.js';

for (const [role, status] of [[undefined, 401], ['Reader', 403], ['Admin', 200]] as const) {
    describe(`when discovering endpoints with a native ${role ?? 'anonymous'} principal`, () => {
        let responses: (Response | null)[];
        beforeEach(async () => {
            const context = new a_discovery_host();
            const server = new ArcServer({ environmentName: 'Production', nativePrincipal: true, introspection: { roles: 'Admin' } });
            try {
                responses = await Promise.all(context.paths.map(path => server.handle(new Request(`http://localhost${path}`),
                    role ? { principal: { id: 'reader', roles: [role], isAuthenticated: true } } : undefined)));
            } finally { await server.dispose(); }
        });
        it('should enforce the same authentication and role policy', () => responses.map(response => response?.status).should.deep.equal(Array(6).fill(status)));
    });
}

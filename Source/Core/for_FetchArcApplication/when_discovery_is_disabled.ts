// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { FetchArcApplication } from '../FetchArcApplication.js';
import { AuthenticationStatus } from '../authentication/AuthenticationStatus.js';

for (const environmentName of ['Development', 'Production']) {
    describe(`when fetch discovery is disabled in ${environmentName}`, () => {
        let statuses: number[];
        let handled: (Response | null)[];
        beforeEach(async () => {
            const application = await FetchArcApplication.createBuilder({ environmentName, introspection: { enabled: false },
                authentication: [() => ({ status: AuthenticationStatus.Authenticated,
                    principal: { id: 'operator', roles: [], isAuthenticated: true } })] }).build();
            try {
                const paths = ['/.cratis/commands', '/.cratis/queries', '/openapi.json'];
                handled = await Promise.all(paths.map(path => application.handle(new Request(`http://localhost${path}`))));
                statuses = await Promise.all(paths.map(async path => (await application.fetch(new Request(`http://localhost${path}`))).status));
            } finally { await application.dispose(); }
        });
        it('should preserve fall-through for the host', () => handled.should.deep.equal([null, null, null]));
        it('should answer 404 from the fetch handler', () => statuses.should.deep.equal([404, 404, 404]));
    });
}

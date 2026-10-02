// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../ArcApplication.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';

for (const role of ['Reader', 'Admin']) describe(`when an undefined roles override overlays configured roles for ${role}`, () => {
    let statuses: number[];
    beforeEach(async () => {
        const application = await ArcApplication.createBuilder({ environmentName: 'Production',
            configuration: { file: '/nonexistent/appsettings.json', env: { Cratis__Arc__Introspection__Roles: 'Admin' } },
            introspection: { roles: undefined }, authentication: [() => ({ status: AuthenticationStatus.Authenticated,
                principal: { id: 'operator', isAuthenticated: true, roles: [role] } })] }).build();
        try {
            statuses = await Promise.all(['/.cratis/commands', '/.cratis/queries', '/openapi.json', '/.cratis/identity-details/schema'].map(async path =>
                (await application.fetch(new Request(`http://localhost${path}`))).status));
        } finally { await application.dispose(); }
    });
    it('should retain the configured role requirement', () => statuses.should.deep.equal(Array(4).fill(role === 'Admin' ? 200 : 403)));
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../ArcApplication.js';
import { AuthenticationStatus } from '../authentication/AuthenticationStatus.js';

for (const enabled of [true, false, undefined]) describe(`when overriding configured discovery enabled with ${enabled}`, () => {
    let status: number;
    let schemaStatus: number;
    beforeEach(async () => {
        const application = await ArcApplication.createBuilder({ configuration: { file: '/nonexistent/appsettings.json', env: {
            Cratis__Arc__Introspection__Enabled: String(enabled === false),
            Cratis__Arc__Introspection__RequireAuthentication: 'true',
            Cratis__Arc__Introspection__Roles: 'Admin'
        } }, environmentName: 'Development', introspection: enabled === undefined ? undefined : { enabled },
        authentication: [() => ({ status: AuthenticationStatus.Authenticated,
            principal: { id: 'reader', isAuthenticated: true, roles: ['Reader'] } })] }).build();
        try {
            status = (await application.fetch(new Request('http://localhost/.cratis/commands'))).status;
            schemaStatus = (await application.fetch(new Request('http://localhost/.cratis/identity-details/schema'))).status;
        } finally { await application.dispose(); }
    });
    it('should use the code switch when supplied and configuration otherwise', () => status.should.equal(enabled === true ? 403 : 404));
    it('should retain the configured identity discovery policy', () => schemaStatus.should.equal(403));
});

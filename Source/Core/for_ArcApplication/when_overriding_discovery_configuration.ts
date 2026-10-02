// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../ArcApplication.js';
import { AuthenticationStatus } from '../authentication/AuthenticationStatus.js';

describe('when overriding discovery configuration with code options', () => {
    let status: number;
    beforeEach(async () => {
        const application = await ArcApplication.createBuilder({ configuration: { file: '/nonexistent/appsettings.json', env: {
            Cratis__Arc__Introspection__RequireAuthentication: 'false',
            Cratis__Arc__Introspection__Roles: ' Admin '
        } }, environmentName: 'Development', introspection: { requireAuthentication: true },
        authentication: [() => ({ status: AuthenticationStatus.Authenticated,
            principal: { id: 'reader', isAuthenticated: true, roles: ['Reader'] } })] }).build();
        try { status = (await application.server.handle(new Request('http://localhost/.cratis/commands')))!.status; }
        finally { await application.dispose(); }
    });
    it('should override the explicit false while retaining configured roles', () => status.should.equal(403));
});

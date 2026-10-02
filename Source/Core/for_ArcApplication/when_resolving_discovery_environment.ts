// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../ArcApplication.js';
import { AuthenticationStatus } from '../authentication/AuthenticationStatus.js';

for (const [env, status] of [
    [{ DOTNET_ENVIRONMENT: 'Development', ASPNETCORE_ENVIRONMENT: 'Production', NODE_ENV: 'production' }, 200],
    [{ ASPNETCORE_ENVIRONMENT: 'Development', NODE_ENV: 'production' }, 200],
    [{ NODE_ENV: 'development' }, 200],
    [{ DOTNET_ENVIRONMENT: 'Production', NODE_ENV: 'development' }, 401],
    [{}, 401]
] as const) {
    describe(`when resolving discovery environment from supplied configuration ${JSON.stringify(env)}`, () => {
        let response: Response | null;
        beforeEach(async () => {
            const application = await ArcApplication.createBuilder({ configuration: { file: '/nonexistent/appsettings.json', env },
                authentication: [() => ({ status: AuthenticationStatus.Anonymous })] }).build();
            try { response = await application.server.handle(new Request('http://localhost/.cratis/commands')); }
            finally { await application.dispose(); }
        });
        it('should use the appsettings environment precedence rather than the ambient test environment', () => response!.status.should.equal(status));
    });
}

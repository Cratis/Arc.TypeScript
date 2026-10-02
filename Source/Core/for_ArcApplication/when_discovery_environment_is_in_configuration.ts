// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../ArcApplication.js';
import { AuthenticationStatus } from '../authentication/AuthenticationStatus.js';

for (const source of ['file', 'environment']) {
    describe(`when a discovery environment override is supplied through a configuration ${source}`, () => {
        let status: number;
        let environment: string | undefined;
        let warnings: string[];
        beforeEach(async () => {
            warnings = [];
            const application = await ArcApplication.createBuilder({ configuration: {
                file: source === 'file' ? new URL('./given/with_environment_override/appsettings.json', import.meta.url) : '/nonexistent/appsettings.json',
                env: { DOTNET_ENVIRONMENT: 'Production', ...(source === 'environment' ? { Cratis__Arc__EnvironmentName: 'Development' } : {}) }
            }, logger: error => warnings.push(String(error)),
            authentication: [() => ({ status: AuthenticationStatus.Anonymous })] }).build();
            try {
                environment = application.server.options.environmentName;
                status = (await application.server.handle(new Request('http://localhost/.cratis/commands')))!.status;
            } finally { await application.dispose(); }
        });
        it('should not reopen anonymous discovery in Production', () => status.should.equal(401));
        it('should retain the host environment', () => environment!.should.equal('Production'));
        it('should report the unsupported configuration key', () => warnings.should.have.lengthOf(1));
    });
}

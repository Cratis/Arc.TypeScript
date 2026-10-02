// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../ArcApplication.js';

for (const fromEnvironment of [false, true]) describe(`when an undefined code switch overlays disabled catalogs from ${fromEnvironment ? 'environment' : 'appsettings'}`, () => {
    let statuses: number[];
    beforeEach(async () => {
        const application = await ArcApplication.createBuilder({ environmentName: 'Development',
            configuration: fromEnvironment ? { file: '/nonexistent/appsettings.json', env: { Cratis__Arc__Introspection__Enabled: 'false' } } : {
                file: new URL('../../configuration/for_loadConfiguration/given/introspection/appsettings.json', import.meta.url),
                env: { DOTNET_ENVIRONMENT: 'Production' }
            }, introspection: { enabled: undefined } }).build();
        try {
            statuses = await Promise.all(['/.cratis/commands', '/.cratis/queries', '/openapi.json'].map(async path =>
                (await application.fetch(new Request(`http://localhost${path}`))).status));
        } finally { await application.dispose(); }
    });
    it('should keep the configured catalogs and OpenAPI disabled', () => statuses.should.deep.equal([404, 404, 404]));
});

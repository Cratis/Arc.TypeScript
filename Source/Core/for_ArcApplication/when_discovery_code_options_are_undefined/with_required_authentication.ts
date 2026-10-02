// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../ArcApplication.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';

for (const environmentName of ['Development', 'Production']) describe(`when an undefined authentication override overlays configured authentication in ${environmentName}`, () => {
    let statuses: number[];
    beforeEach(async () => {
        const application = await ArcApplication.createBuilder({ environmentName,
            configuration: { file: '/nonexistent/appsettings.json', env: { Cratis__Arc__Introspection__RequireAuthentication: 'true' } },
            introspection: { requireAuthentication: undefined }, authentication: [() => ({ status: AuthenticationStatus.Anonymous })] }).build();
        try {
            statuses = await Promise.all(['/.cratis/commands', '/.cratis/queries', '/openapi.json', '/.cratis/identity-details/schema'].map(async path =>
                (await application.fetch(new Request(`http://localhost${path}`))).status));
        } finally { await application.dispose(); }
    });
    it('should still reject anonymous discovery callers', () => statuses.should.deep.equal([401, 401, 401, 401]));
});

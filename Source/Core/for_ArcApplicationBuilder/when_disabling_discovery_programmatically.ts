// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, ArcApplicationBuilder as NodeBuilder } from '../index.js';
import { ArcApplication as FetchApplication, ArcApplicationBuilder as FetchBuilder } from '../fetch.js';

for (const [name, create] of [
    ['Node application factory', () => ArcApplication.createBuilder({ configuration: false, environmentName: 'Development', introspection: { enabled: false } })],
    ['Node builder constructor', () => new NodeBuilder({ environmentName: 'Development', introspection: { enabled: false } })],
    ['fetch application factory', () => FetchApplication.createBuilder({ environmentName: 'Development', introspection: { enabled: false } })],
    ['fetch builder constructor', () => new FetchBuilder({ environmentName: 'Development', introspection: { enabled: false } })]
] as const) describe(`when disabling discovery programmatically through the ${name}`, () => {
    let statuses: number[];
    beforeEach(async () => {
        const application = await create().build();
        try {
            statuses = await Promise.all(['/.cratis/commands', '/.cratis/queries', '/openapi.json'].map(async path =>
                (await application.fetch(new Request(`http://localhost${path}`))).status));
        } finally { await application.dispose(); }
    });
    it('should leave catalogs and OpenAPI unmapped', () => statuses.should.deep.equal([404, 404, 404]));
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CratisApplication } from '../index.js';

describe('when the Cratis application overrides configured discovery in code', () => {
    let statuses: number[];
    beforeEach(async () => {
        const application = await CratisApplication.createBuilder({ environmentName: 'Development',
            configuration: { file: '/nonexistent/appsettings.json', env: { Cratis__Arc__Introspection__Enabled: 'true' } },
            introspection: { enabled: false } }, { eventStore: 'Tasks', connectionString: 'chronicle://localhost:35000' }).build();
        try {
            statuses = await Promise.all(['/.cratis/commands', '/.cratis/queries', '/openapi.json'].map(async path =>
                (await application.fetch(new Request(`http://localhost${path}`))).status));
        } finally { await application.dispose(); }
    });
    it('should apply the code option ahead of configuration', () => statuses.should.deep.equal([404, 404, 404]));
});

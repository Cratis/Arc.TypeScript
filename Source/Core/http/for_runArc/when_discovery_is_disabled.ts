// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer } from '../../ArcServer.js';
import { runArc } from '../runArc.js';
import { exchange, portOf } from './given/a_node_host.js';

for (const environmentName of ['Development', 'Production']) describe(`when the standalone Node host disables discovery in ${environmentName}`, () => {
    let statuses: number[];
    beforeEach(async () => {
        const arc = new ArcServer({ environmentName, introspection: { enabled: false }, nativePrincipal: true });
        const host = await runArc(arc, { port: 0 });
        try {
            statuses = await Promise.all(['/.cratis/commands', '/.cratis/queries', '/openapi.json'].map(async path =>
                (await exchange(portOf(host.server), path)).status));
        } finally { await host.close(); await arc.dispose(); }
    });
    it('should answer 404 for the disabled server endpoints', () => statuses.should.deep.equal([404, 404, 404]));
});

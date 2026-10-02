// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createServer } from 'node:http';
import { ArcServer } from '../../ArcServer.js';
import { createArcNodeHandler } from '../createArcNodeHandler.js';
import { exchange, portOf } from '../for_runArc/given/a_node_host.js';

for (const environmentName of ['Development', 'Production']) describe(`when a caller-owned Node handler disables discovery in ${environmentName}`, () => {
    let statuses: number[];
    beforeEach(async () => {
        const arc = new ArcServer({ environmentName, introspection: { enabled: false }, nativePrincipal: true });
        const listener = createServer(createArcNodeHandler(arc, { pathBase: '/app' }));
        await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
        try {
            statuses = await Promise.all(['/.cratis/commands', '/.cratis/queries', '/openapi.json'].map(async path =>
                (await exchange(portOf(listener), `/app${path}`)).status));
        } finally {
            listener.closeAllConnections();
            await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
            await arc.dispose();
        }
    });
    it('should answer 404 for the disabled server endpoints', () => statuses.should.deep.equal([404, 404, 404]));
});

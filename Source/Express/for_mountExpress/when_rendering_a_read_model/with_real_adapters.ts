// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { given } from '../../../Core/given.js';
import { a_rendering_server } from '../../../Core/queries/for_queryRendering/given/a_rendering_server.js';
import { hosts, socket, startHost } from '../../for_identityHosts/given/a_real_identity_host.js';
should();

for (const host of hosts) describe(`when rendering a read model with ${host}`, given(a_rendering_server, context => {
    let data: unknown;
    beforeEach(async () => {
        const listener = await startHost(host, context.server as unknown as Parameters<typeof startHost>[1]);
        try {
            const response = await socket(listener.port, false, '/api/watch');
            response.status.should.equal(200);
            data = JSON.parse(response.body).data;
        } finally { await listener.close(); }
    });
    it('should intercept the observable HTTP snapshot in the request scope', () => {
        (data as object[]).should.deep.equal([{ name: 'public-initial' }]);
    });
}));

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, defineQuery } from '../index.js';

describe('when an authentication handler supplies its own scheme', () => {
    let response: Response;
    beforeEach(async () => {
        const handler = () => ({ status: AuthenticationStatus.Authenticated as const,
            principal: { id: 'alice', roles: [], isAuthenticated: true, scheme: 'Verified' } });
        const server = new ArcServer({ authentication: [handler],
            queries: [defineQuery({ name: 'Default', schema: z.object({}), perform: (_input, context) => context.principal?.scheme ?? 'none' })] });
        try { response = (await server.handle(new Request('http://localhost/api/default')))!; }
        finally { await server.dispose(); }
    });
    it('should remove the untrusted scheme on the default handler', async () => {
        (await response.json()).data.should.equal('none');
    });
});

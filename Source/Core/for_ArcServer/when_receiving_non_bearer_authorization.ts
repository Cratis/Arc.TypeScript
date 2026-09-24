// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer, defineQuery, jwtBearer } from '../index.js';

describe('when a public route receives a non-Bearer authorization header', () => {
    let response: Response;
    beforeEach(async () => {
        const server = new ArcServer({ authentication: [jwtBearer({ jwksUrl: new URL('https://keys.example/jwks'),
            issuer: 'https://issuer.example/', audience: 'arc', algorithms: ['RS256'] })],
        queries: [defineQuery({ name: 'Public', schema: z.object({}), authorization: { anonymous: true }, perform: () => 'ok' })] });
        try { response = (await server.handle(new Request('http://localhost/api/public', {
            headers: { authorization: 'Basic abc' }
        })))!; } finally { await server.dispose(); }
    });
    it('should not reject credentials meant for another handler', () => { response.status.should.equal(200); });
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { renderOpenApi } from '../../renderOpenApi.js';
import { jwtBearer } from '../../../authentication/jwtBearer.js';
import type { Operation } from '../../../http/Operation.js';

const handler = jwtBearer({ jwksUrl: new URL('https://example.invalid/keys'), issuer: 'issuer', audience: 'audience', algorithms: ['RS256'] });

describe('when documenting security with a registered bearer handler', () => {
    let document: Record<string, unknown>;
    beforeEach(() => {
        const operation = { kind: 'command', name: 'Save', route: '/api/save', schema: z.object({}), inputSchema: {},
            authorization: { authenticated: true }, run: async () => { throw new Error('not called'); } } as Operation;
        document = renderOpenApi([operation], [], { authentication: [handler] });
    });
    it('should advertise bearer security for a protected operation', () => {
        const components = document.components as { securitySchemes: Record<string, unknown> };
        components.securitySchemes.should.have.property('bearer');
        const paths = document.paths as Record<string, { post: { security: { bearer: [] }[] } }>;
        paths['/api/save']!.post.security.should.deep.equal([{ bearer: [] }]);
    });
});

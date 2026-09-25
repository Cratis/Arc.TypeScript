// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { given } from '../../../given.js';
import { renderOpenApi } from '../../renderOpenApi.js';
import { jwtBearer } from '../../../authentication/jwtBearer.js';
import type { Operation } from '../../../http/Operation.js';
import type { AuthenticationHandler } from '../../../authentication/AuthenticationHandler.js';
import { AuthenticationStatus } from '../../../authentication/AuthenticationStatus.js';

const jwt = jwtBearer({ jwksUrl: new URL('https://example.invalid/keys'), issuer: 'issuer', audience: 'audience', algorithms: ['RS256'] });
const custom: AuthenticationHandler = async () => ({ status: AuthenticationStatus.Anonymous });
class a_named_handler {
    readonly options = { authentication: [custom], authenticationSchemes: { jwt, bearer: jwt } };
    operation(authorization: Operation['authorization']): Operation {
        return { kind: 'command', name: 'Save', fullyQualifiedName: 'Save', route: '/api/save',
            schema: z.object({}), inputSchema: {}, authorization,
            run: async () => { throw new Error('not called'); } } as Operation;
    }
    security(operation: Operation): unknown {
        const document = renderOpenApi([operation], [], this.options);
        return (document.paths as Record<string, { post: { security?: unknown } }>)['/api/save']!.post.security;
    }
}
describe('when documenting named and custom authentication', given(a_named_handler, context => {
    it('should not advertise a named bearer when only the custom default authenticates', () => {
        (context.security(context.operation({ authenticated: true })) === undefined).should.equal(true);
    });
    it('should advertise the selected named scheme', () => {
        (context.security(context.operation({ authenticated: true, schemes: ['jwt'] })) as object).should.deep.equal([{ jwt: [] }]);
    });
    it('should not advertise bearer security on an anonymous operation', () => {
        (context.security(context.operation({ anonymous: true })) === undefined).should.equal(true);
    });
    it('should avoid reusing the named bearer component for the default bearer', () => {
        const document = renderOpenApi([context.operation({ authenticated: true })], [], {
            authentication: [jwt], authenticationSchemes: { bearer: jwt } });
        const security = (document.paths as Record<string, { post: { security: unknown } }>)['/api/save']!.post.security;
        (security as object).should.deep.equal([{ arcBearer: [] }]);
        Object.keys((document.components as { securitySchemes: object }).securitySchemes).should.deep.equal(['bearer', 'arcBearer']);
    });
}));

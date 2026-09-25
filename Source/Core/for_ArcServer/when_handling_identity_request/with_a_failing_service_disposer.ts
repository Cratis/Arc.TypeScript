// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { identityGet, identityPrincipal } from '../given/an_identity_request.js';

should();
describe('when handling an identity request with a failing service disposer', () => {
    let status: number;
    let cookie: boolean;
    let body: string;
    beforeEach(async () => {
        const token = serviceToken<{ [Symbol.asyncDispose](): Promise<void> }>('cleanup');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ async [Symbol.asyncDispose]() { throw Error('private cleanup'); } }) }],
            authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal: identityPrincipal })],
            identityDetails: { schema: z.object({ secret: z.string() }), provide: async () => { await currentServices().resolve(token); return { secret: 'never publish' }; } } });
        const response = (await identityGet(server, '/.cratis/me'))!;
        status = response.status;
        cookie = response.headers.has('set-cookie');
        body = await response.text();
        await server.dispose();
    });
    it('should return an error instead of publishing successful details', () => {
        status.should.equal(500);
        body.should.not.contain('never publish');
    });
    it('should not issue a partial identity cookie', () => cookie.should.equal(false));
});

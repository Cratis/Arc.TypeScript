// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { identityGet, identityPrincipal } from '../given/an_identity_request.js';

should();
describe('when handling identity requests with a failing singleton', () => {
    let responses: { status: number; cookie: boolean; body: string; repeatStatus: number; events: string[] }[];
    beforeEach(async () => {
        responses = [];
        for (const discovery of [false, true]) {
            const partial = serviceToken<object>('partial singleton');
            const broken = serviceToken<object>('broken singleton');
            const events: string[] = [];
            const server = new ArcServer({ services: [
                { token: partial, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => { events.push('disposed'); throw Error('private cleanup'); } }) },
                { token: broken, lifetime: 'singleton', dependencies: [partial], factory: async scope => { await scope.resolve(partial); throw Error('private singleton'); } }
            ], authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal: identityPrincipal })],
            identityDetails: { schema: z.object({ value: z.string() }), provide: async () => { await currentServices().resolve(broken); return { value: 'secret' }; } },
            development: true, developmentTenants: async () => { await currentServices().resolve(broken); return [{ id: 'secret', name: 'secret' }]; } });
            const path = discovery ? '/.cratis/tenants' : '/.cratis/me';
            const result = (await identityGet(server, path))!;
            responses.push({ status: result.status, cookie: result.headers.has('set-cookie'), body: await result.text(), events,
                repeatStatus: (await identityGet(server, path))!.status });
            await server.dispose().catch(() => undefined);
        }
    });
    it('should fail closed without exposing singleton or cleanup errors', () => {
        responses.should.have.lengthOf(2);
        for (const response of responses) {
            response.status.should.equal(500);
            response.cookie.should.equal(false);
            response.body.should.not.contain('private');
        }
    });
    it('should drain partial singleton cleanup before either endpoint responds', () => responses.forEach(response => response.events.should.deep.equal(['disposed'])));
    it('should continue rejecting new identity and discovery requests after singleton failure', () => responses.forEach(response => response.repeatStatus.should.equal(500)));
});

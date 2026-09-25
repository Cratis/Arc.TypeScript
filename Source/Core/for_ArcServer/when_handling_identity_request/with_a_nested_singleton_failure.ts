// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { identityGet, identityPrincipal } from '../given/an_identity_request.js';

should();
describe('when handling an identity request with a nested singleton failure', () => {
    let nested: { status: number; cookie: boolean; events: string[] };
    let outerSuccess: boolean;
    let events: string[];
    beforeEach(async () => {
        const partial = serviceToken<object>('nested partial singleton');
        const broken = serviceToken<object>('nested broken singleton');
        events = [];
        const server = new ArcServer({ services: [
            { token: partial, lifetime: ServiceLifetime.Singleton,
                factory: () => ({ [Symbol.dispose]: () => { events.push('singleton disposed'); } }) },
            { token: broken, lifetime: ServiceLifetime.Singleton,
                factory: async scope => { await scope.resolve(partial); throw Error('secret'); } }
        ], authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal: identityPrincipal })],
        identityDetails: { schema: z.object({ value: z.string() }), provide: async () => { await currentServices().resolve(broken); return { value: 'secret' }; } },
        queries: [defineQuery({ name: 'Outer', schema: z.object({}), perform: async () => {
            const response = (await identityGet(server, '/.cratis/me'))!;
            nested = { status: response.status, cookie: response.headers.has('set-cookie'), events: [...events] };
            return 'never publish';
        } })] });
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const result = await Promise.race([server.performQuery('Outer', {}, {
                correlationId: crypto.randomUUID(), principal: undefined, tenantId: undefined, signal: new AbortController().signal, allowedSeverity: 2
            }), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(Error('nested provider hung')), 1000); })]);
            outerSuccess = result.isSuccess;
        } finally {
            if (timer) clearTimeout(timer);
            await server.dispose();
        }
    });
    it('should reject the nested request without publishing identity data', () => {
        nested.status.should.equal(500);
        nested.cookie.should.equal(false);
    });
    it('should leave singleton cleanup to the living query ancestor', () => {
        nested.events.should.deep.equal([]);
        events.should.deep.equal(['singleton disposed']);
    });
    it('should fail the outer query rather than publish its response', () => outerSuccess.should.equal(false));
});

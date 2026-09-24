// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, currentContext } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { identityGet, identityPrincipal } from '../given/an_identity_request.js';

should();
describe('when handling identity requests with tenant-isolated services', () => {
    let statuses: number[];
    let tenants: string[];
    let ambientMatches: boolean[];
    let disposed: number;
    beforeEach(async () => {
        disposed = 0;
        ambientMatches = [];
        const token = serviceToken<{ tenant: string; [Symbol.asyncDispose](): Promise<void> }>('identity');
        const server = new ArcServer({ services: [{ token, lifetime: 'scoped', factory: async (_resolver, identity) =>
            ({ tenant: identity.tenantId!, async [Symbol.asyncDispose]() { disposed++; } }) }],
            authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal: identityPrincipal })],
            identityDetails: { schema: z.object({ tenant: z.string() }), provide: async (_principal, context) => {
                ambientMatches.push(currentContext()!.tenantId === context.tenantId);
                const service = await currentServices().resolve(token);
                if (context.tenantId === 'deny') return undefined;
                if (context.tenantId === 'error') throw Error('secret');
                await Promise.resolve();
                return { tenant: service.tenant };
            } } });
        const responses = await Promise.all(['north', 'south', 'deny', 'error'].map(value => identityGet(server, '/.cratis/me', { 'x-cratis-tenant-id': value })));
        statuses = responses.map(response => response!.status);
        tenants = [(await responses[0]!.json()).details.tenant, (await responses[1]!.json()).details.tenant];
        await server.dispose();
    });
    it('should return per-tenant details and deny failed providers', () => {
        statuses.should.deep.equal([200, 200, 403, 500]);
        tenants.should.deep.equal(['north', 'south']);
    });
    it('should retain tenant context in each provider', () => ambientMatches.should.deep.equal([true, true, true, true]));
    it('should dispose the scoped service for success denial and failure', () => disposed.should.equal(4));
});

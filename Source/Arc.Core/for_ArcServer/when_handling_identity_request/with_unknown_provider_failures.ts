// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { identityGet, identityPrincipal } from '../given/an_identity_request.js';

should();
describe('when handling identity requests with unknown provider failures', () => {
    let outcomes: { status: number; body: string; cookie: boolean; cache: string | null }[];
    let logs: unknown[][];
    beforeEach(async () => {
        outcomes = [];
        logs = [];
        for (const reason of [undefined, null, 'private failure']) {
            const logged: unknown[] = [];
            const server = new ArcServer({ authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal: identityPrincipal })],
                identityDetails: { schema: z.object({}), provide: () => Promise.reject(reason) },
                development: true, developmentTenants: () => Promise.reject(reason),
                logger: error => { logged.push(error); throw new Error('logger failed'); } });
            for (const path of ['/.cratis/me', '/.cratis/tenants']) {
                const response = (await identityGet(server, path))!;
                outcomes.push({ status: response.status, body: await response.text(), cookie: response.headers.has('set-cookie'), cache: response.headers.get('cache-control') });
            }
            logs.push(logged);
            await server.dispose();
        }
    });
    it('should fail closed without exposing the unknown failure or setting an identity cookie', () => {
        outcomes.should.have.lengthOf(6);
        for (const outcome of outcomes) {
            outcome.status.should.equal(500);
            outcome.body.should.not.contain('private failure');
            outcome.cookie.should.equal(false);
        }
    });
    it('should prevent caching of failed identity responses', () => outcomes.filter((_, index) => index % 2 === 0).map(result => result.cache).should.deep.equal(['no-store', 'no-store', 'no-store']));
    it('should log the original reason for identity and discovery', () => logs.should.deep.equal([[undefined, undefined], [null, null], ['private failure', 'private failure']]));
});

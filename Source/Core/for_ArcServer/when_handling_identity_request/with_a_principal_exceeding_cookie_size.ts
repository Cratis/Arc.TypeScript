// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { identityDetails, identityGet } from '../given/an_identity_request.js';

should();
describe('when handling an identity request with a principal exceeding cookie size', () => {
    let status: number;
    let cookie: boolean;
    beforeEach(async () => {
        const server = new ArcServer({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
            principal: { id: 'x'.repeat(3000), isAuthenticated: true, roles: [] } })], identityDetails });
        const response = (await identityGet(server, '/.cratis/me'))!;
        status = response.status;
        cookie = response.headers.has('set-cookie');
        await server.dispose();
    });
    it('should reject oversized identity cookie publication without weakening authentication', () => {
        status.should.equal(500);
        cookie.should.equal(false);
    });
});

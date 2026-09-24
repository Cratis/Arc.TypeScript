// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { identityDetails, identityGet, identityPrincipal } from '../given/an_identity_request.js';

should();
describe('when handling an identity request with native principal', () => {
    let conflicting: unknown;
    let forged: number;
    let invalid: number;
    let trusted: number;
    beforeEach(async () => {
        try { new ArcServer({ nativePrincipal: true, authentication: [() => ({ status: AuthenticationStatus.Anonymous })] }); }
        catch (error) { conflicting = error; }
        const server = new ArcServer({ nativePrincipal: true, identityDetails });
        forged = (await identityGet(server, '/.cratis/me', { 'x-user-id': 'ada', 'x-forwarded-user': 'ada' }))!.status;
        invalid = (await server.handle(new Request('http://arc.invalid/.cratis/me'), { principal: { ...identityPrincipal, isAuthenticated: false } }))!.status;
        trusted = (await server.handle(new Request('http://arc.invalid/.cratis/me'), { principal: identityPrincipal }))!.status;
        await server.dispose();
    });
    it('should reject contradictory native and handler authentication', () => (conflicting instanceof Error).should.equal(true));
    it('should ignore forged identity headers', () => forged.should.equal(401));
    it('should reject invalid native principals', () => invalid.should.equal(500));
    it('should accept only explicitly trusted native context', () => trusted.should.equal(200));
});

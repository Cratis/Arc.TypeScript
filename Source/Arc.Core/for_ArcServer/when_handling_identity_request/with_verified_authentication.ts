// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { identityDetails, identityGet, identityPrincipal } from '../given/an_identity_request.js';

should();
describe('when handling an identity request with verified authentication', () => {
    let schema: { properties: { greeting: { type: string } } };
    let forged: { status: number; cache: string | null };
    let authorized: { status: number; value: unknown; cookie: string };
    let replay: number;
    let required: number;
    beforeEach(async () => {
        const server = new ArcServer({ identityDetails, authentication: [request => request.headers.has('Authorization')
            ? { status: AuthenticationStatus.Authenticated, principal: identityPrincipal }
            : { status: AuthenticationStatus.Anonymous }] });
        schema = await (await identityGet(server, '/.cratis/identity-details/schema'))!.json();
        const forgedResponse = (await identityGet(server, '/.cratis/me', { Cookie: `.cratis-identity=${Buffer.from('{"id":"admin"}').toString('base64')}` }))!;
        forged = { status: forgedResponse.status, cache: forgedResponse.headers.get('cache-control') };
        const good = (await identityGet(server, '/.cratis/me', { Authorization: 'verified' }))!;
        authorized = { status: good.status, value: await good.json(), cookie: good.headers.get('set-cookie')! };
        replay = (await identityGet(server, '/.cratis/me', { Cookie: authorized.cookie.split(';')[0]! }))!.status;
        const tenantRequired = new ArcServer({ identityDetails, tenancy: { sources: ['header'], required: true } });
        required = (await identityGet(tenantRequired, '/.cratis/me'))!.status;
        await Promise.all([server.dispose(), tenantRequired.dispose()]);
    });
    it('should expose the provider schema', () => schema.properties.greeting.type.should.equal('string'));
    it('should reject a forged display cookie without caching', () => forged.should.deep.equal({ status: 401, cache: 'no-store' }));
    it('should return the verified identity and UTF-8 details', () => {
        authorized.status.should.equal(200);
        authorized.value!.should.deep.equal({ id: 'ada', name: 'Åda 🌿', isAuthenticated: true, isAuthorized: true,
            roles: ['Reader'], details: { greeting: 'こんにちは 🌿' } });
    });
    it('should issue a readable bounded display cookie matching the response', () => {
        authorized.cookie.should.contain('Path=/; SameSite=Lax');
        authorized.cookie.should.not.contain('HttpOnly');
        authorized.cookie.should.not.contain('Secure');
        JSON.parse(atob(authorized.cookie.split(';')[0]!.split('=')[1]!)).should.deep.equal(authorized.value);
        Buffer.byteLength(authorized.cookie).should.be.at.most(4096);
    });
    it('should not authenticate by replaying the display cookie', () => replay.should.equal(401));
    it('should deny anonymous requests when a tenant is required', () => required.should.equal(401));
});

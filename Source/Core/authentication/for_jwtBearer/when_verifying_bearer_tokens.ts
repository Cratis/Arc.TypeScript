// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import sinon from 'sinon';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { jwtBearer, AuthenticationStatus } from '../../index.js';

should();

describe('when verifying bearer tokens against a pinned JWKS', () => {
    let statuses: string[];
    let principal: unknown;
    beforeEach(async () => {
        const { publicKey, privateKey } = await generateKeyPair('RS256');
        const jwk = { ...await exportJWK(publicKey), kid: 'one', alg: 'RS256', use: 'sig' };
        const fetcher = sinon.stub(globalThis, 'fetch').resolves(new Response(JSON.stringify({ keys: [jwk] }), {
            status: 200, headers: { 'content-type': 'application/json' }
        }));
        try {
            const authenticate = jwtBearer({ jwksUrl: new URL('https://keys.example/jwks'), issuer: 'https://issuer.example/',
                audience: 'arc', algorithms: ['RS256'] });
            const token = await new SignJWT({ roles: ['Reader'], name: 'Alice' }).setProtectedHeader({ alg: 'RS256', kid: 'one' })
                .setSubject('alice').setIssuedAt().setExpirationTime('5m').setIssuer('https://issuer.example/').setAudience('arc').sign(privateKey);
            const request = (value?: string) => new Request('https://arc.example/api', {
                headers: value === undefined ? {} : { authorization: `Bearer ${value}` }
            });
            const anonymous = await authenticate(request());
            const valid = await authenticate(request(token));
            const invalid = await authenticate(request(token + 'corrupted'));
            statuses = [anonymous.status, valid.status, invalid.status];
            principal = valid.status === AuthenticationStatus.Authenticated ? valid.principal : undefined;
        } finally { fetcher.restore(); }
    });
    it('should ignore a request without a bearer token', () => { statuses[0]!.should.equal(AuthenticationStatus.Anonymous); });
    it('should accept a signed token with the pinned issuer and audience', () => {
        statuses[1]!.should.equal(AuthenticationStatus.Authenticated);
        (principal as { id: string; roles: string[] }).id.should.equal('alice');
        (principal as { id: string; roles: string[] }).roles.should.deep.equal(['Reader']);
    });
    it('should fail closed on a tampered signature', () => { statuses[2]!.should.equal(AuthenticationStatus.Failed); });
});

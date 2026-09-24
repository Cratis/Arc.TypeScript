// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import sinon from 'sinon';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { jwtBearer } from '../jwtBearer.js';
import { AuthenticationStatus } from '../AuthenticationStatus.js';

describe('when verifying a token signed with Ed25519', () => {
    let status: AuthenticationStatus;
    beforeEach(async () => {
        const { publicKey, privateKey } = await generateKeyPair('Ed25519');
        const key = { ...await exportJWK(publicKey), kid: 'one', alg: 'Ed25519', use: 'sig' };
        const fetcher = sinon.stub(globalThis, 'fetch').resolves(new Response(JSON.stringify({ keys: [key] }), { status: 200 }));
        try {
            const token = await new SignJWT({}).setProtectedHeader({ alg: 'Ed25519', kid: 'one' })
                .setSubject('alice').setExpirationTime('5m').setIssuer('https://issuer.example/')
                .setAudience('arc').sign(privateKey);
            status = (await jwtBearer({ jwksUrl: new URL('https://keys.example/jwks'), issuer: 'https://issuer.example/',
                audience: 'arc', algorithms: ['Ed25519'] })(new Request('https://arc.example/api', {
                headers: { authorization: `Bearer ${token}` }
            }))).status;
        } finally { fetcher.restore(); }
    });
    it('should accept the pinned asymmetric algorithm', () => { status.should.equal(AuthenticationStatus.Authenticated); });
});

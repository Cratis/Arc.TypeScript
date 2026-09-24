// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import sinon from 'sinon';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { jwtBearer } from '../../jwtBearer.js';

export class a_pinned_jwks {
    fetcher: sinon.SinonStub | undefined;
    async setup(): Promise<{ key: CryptoKey; jwk: Record<string, unknown> }> {
        const { publicKey, privateKey } = await generateKeyPair('RS256');
        const jwk = { ...await exportJWK(publicKey), kid: 'one', alg: 'RS256', use: 'sig' };
        this.fetcher = sinon.stub(globalThis, 'fetch').resolves(new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }));
        return { key: privateKey as CryptoKey, jwk };
    }
    verifier() { return jwtBearer({ jwksUrl: new URL('https://keys.example/jwks'), issuer: 'https://issuer.example/',
        audience: 'arc', algorithms: ['RS256'], jwksTimeoutMs: 1000, jwksCooldownMs: 1000 }); }
    token(key: CryptoKey, claims: Record<string, unknown> = {}) {
        return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'one' }).setSubject('alice')
            .setExpirationTime('5m').setIssuer('https://issuer.example/').setAudience('arc').sign(key);
    }
    restore(): void { this.fetcher?.restore(); }
}

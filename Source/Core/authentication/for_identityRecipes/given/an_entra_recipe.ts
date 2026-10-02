// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { SignJWT, type JWTPayload } from 'jose';
import { jwtBearer } from '../../jwtBearer.js';
import { a_pinned_jwks } from '../../for_jwtBearer/given/a_pinned_jwks.js';
import { an_identity_recipe } from './an_identity_recipe.js';

export class an_entra_recipe extends an_identity_recipe {
    readonly tenant = '11111111-1111-4111-8111-111111111111';
    readonly audience = '22222222-2222-4222-8222-222222222222';
    readonly client = '33333333-3333-4333-8333-333333333333';
    readonly objectId = '44444444-4444-4444-8444-444444444444';
    readonly issuer = `https://login.microsoftonline.com/${this.tenant}/v2.0`;
    readonly keys = new a_pinned_jwks();
    key!: CryptoKey;

    async setup(): Promise<void> {
        this.key = (await this.keys.setup()).key;
        this.configure(jwtBearer({ jwksUrl: new URL(`https://login.microsoftonline.com/${this.tenant}/discovery/v2.0/keys`),
            issuer: this.issuer, audience: this.audience, algorithms: ['RS256'] }));
    }

    token(claims: JWTPayload = {}): Promise<string> {
        const now = Math.floor(Date.now() / 1000);
        return new SignJWT({ sub: 'pairwise-alice', name: 'Alice', oid: this.objectId, tid: this.tenant,
            ver: '2.0', azp: this.client, iss: this.issuer, aud: this.audience, iat: now, nbf: now, exp: now + 300,
            ...claims }).setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: 'one' }).sign(this.key);
    }

    override async dispose(): Promise<void> {
        this.keys.restore();
        await super.dispose();
    }
}

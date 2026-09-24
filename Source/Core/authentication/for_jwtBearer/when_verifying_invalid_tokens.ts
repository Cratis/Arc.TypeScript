// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { SignJWT } from 'jose';
import { given } from '../../given.js';
import { AuthenticationStatus } from '../AuthenticationStatus.js';
import { a_pinned_jwks } from './given/a_pinned_jwks.js';

describe('when verifying invalid bearer credentials', given(a_pinned_jwks, context => {
    let statuses: AuthenticationStatus[];
    beforeEach(async () => {
        const { key } = await context.setup();
        const make = (value: string) => new Request('https://arc.example/api', { headers: { authorization: `Bearer ${value}` } });
        const verify = context.verifier();
        try {
            const expired = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'one' }).setSubject('alice')
                .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
                .setIssuer('https://issuer.example/').setAudience('arc').sign(key);
            const wrongIssuer = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'one' }).setSubject('alice')
                .setExpirationTime('5m').setIssuer('https://other.example/').setAudience('arc').sign(key);
            const wrongAudience = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'one' }).setSubject('alice')
                .setExpirationTime('5m').setIssuer('https://issuer.example/').setAudience('other').sign(key);
            const none = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'alice' })).toString('base64url')}.`;
            const hs = `${Buffer.from(JSON.stringify({ alg: 'HS256', kid: 'one' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'alice' })).toString('base64url')}.signature`;
            statuses = await Promise.all([expired, wrongIssuer, wrongAudience, none, hs, 'not-a-jwt', ''].map(async value =>
                (await verify(make(value))).status));
        } finally { context.restore(); }
    });
    it('should reject an expired token', () => { statuses[0]!.should.equal(AuthenticationStatus.Failed); });
    it('should reject a different issuer', () => { statuses[1]!.should.equal(AuthenticationStatus.Failed); });
    it('should reject a different audience', () => { statuses[2]!.should.equal(AuthenticationStatus.Failed); });
    it('should reject an unsigned token', () => { statuses[3]!.should.equal(AuthenticationStatus.Failed); });
    it('should reject an HMAC token', () => { statuses[4]!.should.equal(AuthenticationStatus.Failed); });
    it('should reject a malformed bearer value', () => { statuses[5]!.should.equal(AuthenticationStatus.Failed); });
    it('should reject an empty bearer value', () => { statuses[6]!.should.equal(AuthenticationStatus.Failed); });
}));

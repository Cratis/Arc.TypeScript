// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, defineQuery } from '@cratis/arc.core';
import { hosts, socket, startHost } from './given/a_real_identity_host.js';

should();

const principal = { id: 'test', name: 'Élise 🌍', roles: ['Reader'], isAuthenticated: true };
const provider = { schema: z.object({ label: z.string() }), provide: () => ({ label: 'naïve 東京' }) };

for (const host of hosts) for (const secure of [false, true]) describe(`when ${host} serves conditional identity over ${secure ? 'HTTPS' : 'HTTP'}`, () => {
    let schema: Awaited<ReturnType<typeof socket>>;
    let users: Awaited<ReturnType<typeof socket>>;
    let tenants: Awaited<ReturnType<typeof socket>>;
    let forged: Awaited<ReturnType<typeof socket>>;
    let forbidden: Awaited<ReturnType<typeof socket>>;
    let response: Awaited<ReturnType<typeof socket>>;
    let cookie: string;
    let cookies: string[];
    let identity: Record<string, unknown>;
    let replay: Awaited<ReturnType<typeof socket>>;
    let foreign: Awaited<ReturnType<typeof socket>>;
    let bypasses: number[];

    beforeEach(async () => {
        let loggedIn = false;
        let denied = false;
        const arc = new ArcServer({
            identityDetails: { schema: provider.schema, provide: () => denied ? undefined : provider.provide() },
            authentication: [request => request.headers.get('authorization') === 'Bearer valid' && loggedIn
                ? { status: AuthenticationStatus.Authenticated, principal }
                : { status: AuthenticationStatus.Anonymous }],
            queries: [defineQuery({ name: 'Tenant', schema: z.object({}), perform: (_input, context) => context.tenantId ?? 'none' })]
        });
        const listener = await startHost(host, arc, { secure, decorated: true });
        try {
            schema = await socket(listener.port, secure, '/.cratis/identity-details/schema');
            users = await socket(listener.port, secure, '/.cratis/users');
            tenants = await socket(listener.port, secure, '/.cratis/tenants');
            forged = await socket(listener.port, secure, '/.cratis/me', { cookie: `.cratis-identity=${Buffer.from('{"id":"forged"}').toString('base64')}`, 'x-forwarded-proto': 'https', 'x-forwarded-user': 'test' });
            loggedIn = true;
            denied = true;
            forbidden = await socket(listener.port, secure, '/.cratis/me', { authorization: 'Bearer valid' });
            denied = false;
            response = await socket(listener.port, secure, '/.cratis/me', { authorization: 'Bearer valid', 'x-forwarded-proto': secure ? 'http' : 'https', host: host === 'Hono' ? 'attacker.invalid' : 'malformed:host:garbage' });
            identity = JSON.parse(response.body);
            cookies = response.headers['set-cookie']!;
            cookie = cookies.find(value => value.startsWith('.cratis-identity='))!;
            replay = await socket(listener.port, secure, '/.cratis/me', { cookie });
            foreign = await socket(listener.port, secure, '/foreign');
            bypasses = [];
            for (const path of ['/api/%2e%2e/.cratis/me', '//.cratis/me', 'http://attacker.invalid/.cratis/me'])
                bypasses.push((await socket(listener.port, secure, path, { authorization: 'Bearer valid' })).status);
        } finally { await listener.close(); }
    });

    it('should serve identity schema', () => { schema.status.should.equal(200); schema.body.should.contain('label'); });
    it('should return no users', () => { users.body.should.equal('[]'); });
    it('should return no tenants', () => { tenants.body.should.equal('[]'); });
    it('should reject forged cookies and forwarded identity', () => { forged.status.should.equal(401); });
    it('should deny missing identity details', () => { forbidden.status.should.equal(403); });
    it('should return the authenticated identity', () => {
        response.status.should.equal(200);
        identity.should.deep.equal({ id: 'test', name: 'Élise 🌍', roles: ['Reader'], isAuthenticated: true,
            isAuthorized: true, details: { label: 'naïve 東京' } });
    });
    it('should disable caching', () => { response.headers['cache-control']?.should.equal('no-store'); });
    it('should replace a forged correlation', () => { response.headers['x-correlation-id']?.should.not.equal('forged'); });
    it('should preserve both host and identity cookies', () => { cookies.should.have.length(2); });
    it('should use the trusted TLS state on the identity cookie', () => { cookie.includes('Secure').should.equal(secure); });
    it('should keep the identity cookie readable by the client', () => { cookie.should.not.contain('HttpOnly'); });
    it('should encode the returned identity in the cookie', () => {
        JSON.parse(atob(cookie.split(';')[0]!.split('=')[1]!)).should.deep.equal(identity);
    });
    it('should bound the cookie size', () => { Buffer.byteLength(cookie).should.be.at.most(4096); });
    it('should not authenticate from a returned cookie', () => { replay.status.should.equal(401); });
    it('should preserve foreign routes', () => { foreign.status.should.equal(200); });
    it('should reject normalized bypass paths', () => { bypasses.every(status => status !== 200).should.be.true; });
});

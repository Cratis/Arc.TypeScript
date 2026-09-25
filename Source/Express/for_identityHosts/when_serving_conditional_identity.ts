// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, defineQuery } from '@cratis/arc.core';
import { hosts, socket, startHost } from './given/a_real_identity_host.js';

const principal = { id: 'test', name: 'Élise 🌍', roles: ['Reader'], isAuthenticated: true };
const provider = { schema: z.object({ label: z.string() }), provide: () => ({ label: 'naïve 東京' }) };

for (const host of hosts) for (const secure of [false, true]) describe(`when ${host} serves conditional identity over ${secure ? 'HTTPS' : 'HTTP'}`, () => {
    let loggedIn: boolean;
    let denied: boolean;
    let listener: Awaited<ReturnType<typeof startHost>>;
    let result: Awaited<ReturnType<typeof socket>>;

    beforeEach(async () => {
        loggedIn = false;
        denied = false;
        const arc = new ArcServer({
            identityDetails: { schema: provider.schema, provide: () => denied ? undefined : provider.provide() },
            authentication: [request => request.headers.get('authorization') === 'Bearer valid' && loggedIn
                ? { status: AuthenticationStatus.Authenticated, principal }
                : { status: AuthenticationStatus.Anonymous }],
            queries: [defineQuery({ name: 'Tenant', schema: z.object({}), perform: (_input, context) => context.tenantId ?? 'none' })]
        });
        listener = await startHost(host, arc, { secure, decorated: true });
    });
    afterEach(async () => { await listener.close(); });

    describe('when requesting identity schema', () => {
        beforeEach(async () => { result = await socket(listener.port, secure, '/.cratis/identity-details/schema'); });
        it('should serve the schema', () => {
            result.status.should.equal(200);
            result.body.should.contain('label');
        });
    });
    describe('when requesting users', () => {
        beforeEach(async () => { result = await socket(listener.port, secure, '/.cratis/users'); });
        it('should return no users', () => { result.body.should.equal('[]'); });
    });
    describe('when requesting tenants', () => {
        beforeEach(async () => { result = await socket(listener.port, secure, '/.cratis/tenants'); });
        it('should return no tenants', () => { result.body.should.equal('[]'); });
    });
    describe('when presenting forged cookies and forwarded identity', () => {
        beforeEach(async () => {
            result = await socket(listener.port, secure, '/.cratis/me', {
                cookie: `.cratis-identity=${Buffer.from('{"id":"forged"}').toString('base64')}`,
                'x-forwarded-proto': 'https', 'x-forwarded-user': 'test'
            });
        });
        it('should reject the request', () => { result.status.should.equal(401); });
    });
    describe('when identity details are unavailable', () => {
        beforeEach(async () => {
            loggedIn = true;
            denied = true;
            result = await socket(listener.port, secure, '/.cratis/me', { authorization: 'Bearer valid' });
        });
        it('should deny the request', () => { result.status.should.equal(403); });
    });
    describe('when the authenticated user requests identity', () => {
        let cookie: string;
        let cookies: string[];
        let identity: Record<string, unknown>;
        beforeEach(async () => {
            loggedIn = true;
            result = await socket(listener.port, secure, '/.cratis/me', {
                authorization: 'Bearer valid', 'x-forwarded-proto': secure ? 'http' : 'https',
                host: host === 'Hono' ? 'attacker.invalid' : 'malformed:host:garbage'
            });
            identity = JSON.parse(result.body);
            cookies = result.headers['set-cookie']!;
            cookie = cookies.find(value => value.startsWith('.cratis-identity='))!;
        });
        it('should return the authenticated identity', () => {
            result.status.should.equal(200);
            identity.should.deep.equal({ id: 'test', name: 'Élise 🌍', roles: ['Reader'], isAuthenticated: true,
                isAuthorized: true, details: { label: 'naïve 東京' } });
        });
        it('should disable caching', () => { result.headers['cache-control']?.should.equal('no-store'); });
        it('should replace a forged correlation', () => { result.headers['x-correlation-id']?.should.not.equal('forged'); });
        it('should preserve both host and identity cookies', () => { cookies.should.have.length(2); });
        it('should use the trusted TLS state on the identity cookie', () => { cookie.includes('Secure').should.equal(secure); });
        it('should keep the identity cookie readable by the client', () => { cookie.should.not.contain('HttpOnly'); });
        it('should encode the returned identity in the cookie', () => {
            JSON.parse(atob(cookie.split(';')[0]!.split('=')[1]!)).should.deep.equal(identity);
        });
        it('should bound the cookie size', () => { Buffer.byteLength(cookie).should.be.at.most(4096); });
        describe('when replaying the cookie', () => {
            beforeEach(async () => { result = await socket(listener.port, secure, '/.cratis/me', { cookie }); });
            it('should not authenticate from the cookie', () => { result.status.should.equal(401); });
        });
    });
    describe('when requesting a foreign route', () => {
        beforeEach(async () => { result = await socket(listener.port, secure, '/foreign'); });
        it('should preserve the route', () => { result.status.should.equal(200); });
    });
    for (const path of ['/api/%2e%2e/.cratis/me', '//.cratis/me', 'http://attacker.invalid/.cratis/me']) {
        describe(`when requesting bypass path ${path}`, () => {
            beforeEach(async () => {
                loggedIn = true;
                result = await socket(listener.port, secure, path, { authorization: 'Bearer valid' });
            });
            it('should reject the normalized path', () => { result.status.should.not.equal(200); });
        });
    }
});

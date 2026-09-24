// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, currentContext, currentServices, defineCommand, defineQuery, serviceToken, type Principal } from '../src/index.js';

should();
const principal = { id: 'ada', name: 'Åda 🌿', roles: ['Reader'], isAuthenticated: true, claims: { tenant: 'north', memberships: 'north,south' } };
const details = { schema: z.object({ greeting: z.string() }), provide: () => ({ greeting: 'こんにちは 🌿' }) };
const get = (server: ArcServer, path: string, headers?: HeadersInit) => server.handle(new Request(`http://arc.invalid${path}`, { headers }));

describe('identity endpoints', () => {
    it('registers me only with a provider; schema and discovery remain available without one', async () => {
        const server = new ArcServer({});
        server.endpoints.has('/.cratis/me').should.equal(false);
        ((await get(server, '/.cratis/me')) === null).should.equal(true);
        (await (await get(server, '/.cratis/identity-details/schema'))!.json()).should.deep.equal({});
        (await (await get(server, '/.cratis/users'))!.json()).should.deep.equal([]);
        (await (await get(server, '/.cratis/tenants'))!.json()).should.deep.equal([]);
        (await get(server, '/.cratis/users', { Cookie: '.cratis-identity=forged' }))!.status.should.equal(200);
    });
    it('returns 401, 403, and exact response with client-readable UTF-8 cache, never trusting the display cookie', async () => {
        const server = new ArcServer({ identityDetails: details, authentication: [request => request.headers.has('Authorization')
            ? { status: AuthenticationStatus.Authenticated, principal }
            : { status: AuthenticationStatus.Anonymous }] });
        const schema = await (await get(server, '/.cratis/identity-details/schema'))!.json();
        schema.properties.greeting.type.should.equal('string');
        const forged = await get(server, '/.cratis/me', { Cookie: `.cratis-identity=${Buffer.from('{"id":"admin"}').toString('base64')}` });
        forged!.status.should.equal(401);
        forged!.headers.get('cache-control')!.should.equal('no-store');
        const good = await get(server, '/.cratis/me', { Authorization: 'verified' });
        good!.status.should.equal(200);
        const value = await good!.json();
        value.should.deep.equal({ id: 'ada', name: 'Åda 🌿', isAuthenticated: true, isAuthorized: true, roles: ['Reader'], details: { greeting: 'こんにちは 🌿' } });
        const cookie = good!.headers.get('set-cookie')!;
        cookie.should.contain('Path=/; SameSite=Lax');
        cookie.should.not.contain('HttpOnly');
        cookie.should.not.contain('Secure');
        JSON.parse(atob(cookie.split(';')[0]!.split('=')[1]!)).should.deep.equal(value);
        Buffer.byteLength(cookie).should.be.at.most(4096);
        (await get(server, '/.cratis/me', { Cookie: cookie.split(';')[0]! }))!.status.should.equal(401);
        const required = new ArcServer({ identityDetails: details, tenancy: { sources: ['header'], required: true } });
        (await get(required, '/.cratis/me'))!.status.should.equal(401);
    });
    it('denies without a cookie, preserves terminal handler failure, and redacts failing providers', async () => {
        const denied = new ArcServer({ identityDetails: { schema: z.object({}), provide: () => undefined }, authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal })] });
        (await get(denied, '/.cratis/me'))!.status.should.equal(403);
        const failed = new ArcServer({ identityDetails: details, authentication: [() => ({ status: AuthenticationStatus.Failed }), () => ({ status: AuthenticationStatus.Authenticated, principal })] });
        (await get(failed, '/.cratis/me'))!.status.should.equal(401);
        const broken = new ArcServer({ identityDetails: { schema: z.object({}), provide: () => { throw Error('private account data'); } }, authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal })] });
        const response = (await get(broken, '/.cratis/me'))!;
        response.status.should.equal(500);
        (await response.text()).should.not.contain('private account data');
    });
    it('runs providers within owned tenant-isolated scopes and disposes on denial and exceptions', async () => {
        const token = serviceToken<{ tenant: string; [Symbol.asyncDispose](): Promise<void> }>('identity');
        let disposed = 0;
        const server = new ArcServer({
            services: [{ token, lifetime: 'scoped', factory: async (_resolver, identity) => ({ tenant: identity.tenantId!, async [Symbol.asyncDispose]() { disposed++; } }) }],
            authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal })],
            identityDetails: { schema: z.object({ tenant: z.string() }), provide: async (_principal, context) => {
                (currentContext()!.tenantId ?? '').should.equal(context.tenantId);
                const service = await currentServices().resolve(token);
                if (context.tenantId === 'deny') return undefined;
                if (context.tenantId === 'error') throw Error('secret');
                await Promise.resolve();
                return { tenant: service.tenant };
            } }
        });
        const responses = await Promise.all(['north', 'south', 'deny', 'error'].map(value => get(server, '/.cratis/me', { 'x-cratis-tenant-id': value })));
        responses.map(response => response!.status).should.deep.equal([200, 200, 403, 500]);
        (await responses[0]!.json()).details.tenant.should.equal('north');
        (await responses[1]!.json()).details.tenant.should.equal('south');
        disposed.should.equal(4);
        await server.dispose();
    });
    it('rejects unknown failures, including undefined, instead of treating them as provider denial or success', async () => {
        for (const reason of [undefined, null, 'private failure']) {
            const logged: unknown[] = [];
            const server = new ArcServer({
                authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal })],
                identityDetails: { schema: z.object({}), provide: () => Promise.reject(reason) },
                development: true, developmentTenants: () => Promise.reject(reason),
                logger: error => { logged.push(error); throw new Error('logger failed'); }
            });
            for (const path of ['/.cratis/me', '/.cratis/tenants']) {
                const response = (await get(server, path))!;
                response.status.should.equal(500);
                (await response.text()).should.not.contain('private failure');
                response.headers.has('set-cookie').should.equal(false);
                if (path === '/.cratis/me') response.headers.get('cache-control')!.should.equal('no-store');
            }
            logged.should.deep.equal([reason, reason]);
            await server.dispose();
        }
    });
    it('bounds the encoded Set-Cookie header, preserving client decoding and no partial identity on overflow', async () => {
        for (const text of ['x'.repeat(2980), '🌿'.repeat(480), 'Å'.repeat(500)]) {
            const server = new ArcServer({ authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal })],
                identityDetails: { schema: z.object({ text: z.string() }), provide: () => ({ text }) } });
            const response = (await get(server, '/.cratis/me'))!;
            response.status.should.equal(500);
            response.headers.has('set-cookie').should.equal(false);
            (await response.text()).should.not.contain(text.slice(0, 20));
            await server.dispose();
        }
        const server = new ArcServer({ authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal })],
            identityDetails: { schema: z.object({ text: z.string() }), provide: () => ({ text: '🌿'.repeat(230) }) } });
        const response = (await get(server, '/.cratis/me'))!;
        response.status.should.equal(200);
        const cookie = response.headers.get('set-cookie')!;
        Buffer.byteLength(cookie).should.be.at.most(4096);
        JSON.parse(atob(cookie.split(';')[0]!.split('=')[1]!)).should.deep.equal(await response.json());
        await server.dispose();
        let lastAccepted = 0;
        let firstRejected = 0;
        for (let count = 230; count <= 260; count++) {
            const candidate = new ArcServer({ authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal })],
                identityDetails: { schema: z.object({ text: z.string() }), provide: () => ({ text: '🌿'.repeat(count) }) } });
            const result = (await get(candidate, '/.cratis/me'))!;
            if (result.status === 200) {
                lastAccepted = count;
                Buffer.byteLength(result.headers.get('set-cookie')!).should.be.at.most(4096);
            } else {
                result.status.should.equal(500);
                result.headers.has('set-cookie').should.equal(false);
                firstRejected = count;
                await candidate.dispose();
                break;
            }
            await candidate.dispose();
        }
        firstRejected.should.equal(lastAccepted + 1);
    });
    it('drains provider singleton failures with partial resources and cleanup errors before responding', async () => {
        for (const discovery of [false, true]) {
            const partial = serviceToken<object>('partial singleton');
            const broken = serviceToken<object>('broken singleton');
            const events: string[] = [];
            const server = new ArcServer({
                services: [
                    { token: partial, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => { events.push('disposed'); throw Error('private cleanup'); } }) },
                    { token: broken, lifetime: 'singleton', dependencies: [partial], factory: async scope => {
                        await scope.resolve(partial);
                        throw Error('private singleton');
                    } }
                ],
                authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal })],
                identityDetails: { schema: z.object({ value: z.string() }), provide: async () => { await currentServices().resolve(broken); return { value: 'secret' }; } },
                development: true, developmentTenants: async () => { await currentServices().resolve(broken); return [{ id: 'secret', name: 'secret' }]; }
            });
            const response = (await get(server, discovery ? '/.cratis/tenants' : '/.cratis/me'))!;
            response.status.should.equal(500);
            response.headers.has('set-cookie').should.equal(false);
            (await response.text()).should.not.contain('private');
            events.should.deep.equal(['disposed']);
            (await get(server, discovery ? '/.cratis/tenants' : '/.cratis/me'))!.status.should.equal(500);
            await server.dispose().catch(() => {});
        }
    });
    it('unwinds a nested provider failure through its living query ancestor', async () => {
        const partial = serviceToken<object>('nested partial singleton');
        const broken = serviceToken<object>('nested broken singleton');
        const events: string[] = [];
        const server = new ArcServer({
            services: [
                { token: partial, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => { events.push('singleton disposed'); } }) },
                { token: broken, lifetime: 'singleton', factory: async scope => { await scope.resolve(partial); throw Error('secret'); } }
            ],
            authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal })],
            identityDetails: { schema: z.object({ value: z.string() }), provide: async () => { await currentServices().resolve(broken); return { value: 'secret' }; } },
            queries: [defineQuery({ name: 'Outer', schema: z.object({}), perform: async () => {
                const nested = (await get(server, '/.cratis/me'))!;
                nested.status.should.equal(500);
                nested.headers.has('set-cookie').should.equal(false);
                events.should.deep.equal([]);
                return 'never publish';
            } })]
        });
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const outer = await Promise.race([server.performQuery('Outer', {}, {
                correlationId: crypto.randomUUID(), principal: undefined, tenantId: undefined, signal: new AbortController().signal, allowedSeverity: 2
            }), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(Error('nested provider hung')), 1000); })]);
            outer.isSuccess.should.equal(false);
            events.should.deep.equal(['singleton disposed']);
        } finally {
            if (timer) clearTimeout(timer);
            await server.dispose();
        }
    });
    it('never publishes successful identity data when owned service disposal fails', async () => {
        const token = serviceToken<{ [Symbol.asyncDispose](): Promise<void> }>('cleanup');
        const server = new ArcServer({
            services: [{ token, lifetime: 'scoped', factory: () => ({ async [Symbol.asyncDispose]() { throw Error('private cleanup'); } }) }],
            authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal })],
            identityDetails: { schema: z.object({ secret: z.string() }), provide: async () => {
                await currentServices().resolve(token);
                return { secret: 'never publish' };
            } }
        });
        const result = (await get(server, '/.cratis/me'))!;
        result.status.should.equal(500);
        result.headers.has('set-cookie').should.equal(false);
        (await result.text()).should.not.contain('never publish');
        await server.dispose();
    });
});

describe('trusted principals and tenants', () => {
    it('rejects conflicting modes, invalid principals, and forged headers; accepts only explicit native context', async () => {
        (() => new ArcServer({ nativePrincipal: true, authentication: [() => ({ status: AuthenticationStatus.Anonymous })] })).should.throw();
        const server = new ArcServer({ nativePrincipal: true, identityDetails: details });
        (await get(server, '/.cratis/me', { 'x-user-id': 'ada', 'x-forwarded-user': 'ada' }))!.status.should.equal(401);
        (await server.handle(new Request('http://arc.invalid/.cratis/me'), { principal: { ...principal, isAuthenticated: false } }))!.status.should.equal(500);
        (await server.handle(new Request('http://arc.invalid/.cratis/me'), { principal }))!.status.should.equal(200);
    });
    it('validates sources and resolves ordered tenant strategies with authenticated claims only', async () => {
        (() => new ArcServer({ tenancy: { sources: ['subdomain'], baseDomain: '127.0.0.1' } })).should.throw();
        (() => new ArcServer({ tenancy: { sources: ['subdomain'], baseDomain: 'example.com:443' } })).should.throw();
        (() => new ArcServer({ tenancy: { sources: ['fixed'], fixed: '../north' } })).should.throw();
        (() => new ArcServer({ tenancy: { sources: ['header', 'header'] } })).should.throw();
        const server = new ArcServer({ nativePrincipal: true, tenancy: { sources: ['subdomain', 'claim', 'header'], baseDomain: 'example.com', claimType: 'tenant', required: true, membershipClaim: 'memberships' },
            queries: [defineQuery({ name: 'Tenant', schema: z.object({}), authorization: { authenticated: true }, perform: (_input, context) => context.tenantId })] });
        const run = (authority: string, identity = principal, header = 'south') => server.handle(new Request('http://arc.invalid/api/tenant', { headers: { 'x-cratis-tenant-id': header, 'x-forwarded-host': 'north.example.com' } }), { principal: identity, authority });
        (await (await run('south.example.com'))!.json()).data.should.equal('south');
        (await (await run('deep.south.example.com'))!.json()).data.should.equal('north');
        (await (await run('unrelated.test'))!.json()).data.should.equal('north');
        (await run('evil.example.com', principal, 'south'))!.status.should.equal(403);
        (await run('south.example.com', principal, '../wrong'))!.status.should.equal(200);
        const anonymous = await server.handle(new Request('http://arc.invalid/api/tenant', { headers: { 'x-cratis-tenant-id': 'north' } }), { authority: 'example.com' });
        anonymous!.status.should.equal(401);
        const authoritative = new ArcServer({ nativePrincipal: true, tenancy: { sources: ['fixed'], fixed: 'north', required: true }, resolveTenant: () => 'custom',
            queries: [defineQuery({ name: 'Tenant', schema: z.object({}), perform: (_input, context) => context.tenantId })] });
        (await (await get(authoritative, '/api/tenant'))!.json()).data.should.equal('custom');
    });
    it('selects only trusted own tenant claims without limiting unused identity data or long memberships', async () => {
        const server = new ArcServer({ nativePrincipal: true, tenancy: { sources: ['claim'], claimType: 'tenant', membershipClaim: 'memberships', required: true },
            queries: [defineQuery({ name: 'Tenant', schema: z.object({}), authorization: { roles: ['Reader'] }, perform: (_input, context) => context.tenantId })] });
        const roles = Array.from({ length: 70 }, (_, index) => `group-${index}`).concat('Reader');
        const identity = { id: 'u'.repeat(1000), name: '', isAuthenticated: true, roles,
            claims: { tenant: 'north', memberships: `${'other,'.repeat(100)}north`, unused: '\u0000'.repeat(500) }, extension: 'kept' };
        const response = (await server.handle(new Request('http://arc.invalid/api/tenant'), { principal: identity }))!;
        response.status.should.equal(200);
        (await response.json()).data.should.equal('north');
        const inherited = Object.assign(Object.create({ tenant: 'north' }) as Record<string, string>, { memberships: 'north' });
        (await server.handle(new Request('http://arc.invalid/api/tenant'), { principal: { ...identity, claims: inherited } }))!.status.should.equal(400);
        await server.dispose();
    });
    it('does not limit authentication to the encoded identity cookie size', async () => {
        const server = new ArcServer({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
            principal: { id: 'x'.repeat(3000), isAuthenticated: true, roles: [] } })], identityDetails: details });
        const response = (await get(server, '/.cratis/me'))!;
        response.status.should.equal(500);
        response.headers.has('set-cookie').should.equal(false);
        await server.dispose();
    });
    it('requires own tenant membership for selected tenants and keeps command/query error envelopes', async () => {
        let invoked = 0;
        const server = new ArcServer({ nativePrincipal: true, tenancy: { sources: ['header'], membershipClaim: 'constructor' },
            commands: [defineCommand({ name: 'Save', schema: z.object({}), handle: () => { invoked++; return 1; } })],
            queries: [defineQuery({ name: 'Read', schema: z.object({}), perform: () => { invoked++; return 1; } })] });
        const request = (path: string, identity?: Principal, tenant = 'north') => server.handle(new Request(`http://arc.invalid${path}`, {
            method: path.includes('save') ? 'POST' : 'GET', headers: { 'x-cratis-tenant-id': tenant }, ...(path.includes('save') ? { body: '{}' } : {})
        }), { principal: identity });
        for (const path of ['/api/save', '/api/read']) {
            for (const identity of [undefined, { ...principal, claims: {} as Record<string, string> }, { ...principal, claims: { constructor: 'south' } }]) {
                const response = (await request(path, identity))!;
                response.status.should.equal(403);
                (await response.json()).isAuthorized.should.equal(false);
            }
            const invalid = (await request(path, { ...principal, claims: { constructor: 'north' } }, '../bad'))!;
            invalid.status.should.equal(400);
            (await invalid.json()).validationResults.should.have.length(1);
            (await request(path, { ...principal, claims: { constructor: 'north' } }))!.status.should.equal(200);
        }
        invoked.should.equal(2);
        const unauthenticated = new ArcServer({ tenancy: { sources: ['fixed'], fixed: 'north', membershipClaim: 'memberships' },
            queries: [defineQuery({ name: 'Read', schema: z.object({}), perform: () => { invoked++; return 1; } })] });
        (await get(unauthenticated, '/api/read'))!.status.should.equal(403);
        invoked.should.equal(2);
        await unauthenticated.dispose();
        const claim = new ArcServer({ nativePrincipal: true, tenancy: { sources: ['claim'], claimType: 'toString' },
            queries: [defineQuery({ name: 'Read', schema: z.object({}), perform: (_input, context) => context.tenantId ?? 'none' })] });
        const noInherited = (await claim.handle(new Request('http://arc.invalid/api/read'), { principal: { ...principal, claims: {} } }))!;
        (await noInherited.json()).data.should.equal('none');
        await claim.dispose();
        await server.dispose();
    });
    it('limits discovery to explicit development providers and redacts failures', async () => {
        (() => new ArcServer({ developmentTenants: () => [] })).should.throw();
        const server = new ArcServer({ development: true, developmentTenants: () => [{ id: 'north', name: 'North' }] });
        (await (await get(server, '/.cratis/tenants'))!.json()).should.deep.equal([{ id: 'north', name: 'North' }]);
        const failure = new ArcServer({ development: true, developmentTenants: () => { throw Error('private tenant'); } });
        const response = (await get(failure, '/.cratis/tenants'))!;
        response.status.should.equal(500);
        (await response.text()).should.not.contain('private tenant');
        const oversized = new ArcServer({ development: true, developmentTenants: () => Array.from({ length: 101 }, (_, index) => ({ id: String(index), name: 'tenant' })) });
        (await get(oversized, '/.cratis/tenants'))!.status.should.equal(500);
    });
});

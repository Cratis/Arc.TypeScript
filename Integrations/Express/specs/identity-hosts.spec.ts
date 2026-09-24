// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { createServer as httpServer, request as httpRequest } from 'node:http';
import { createServer as httpsServer, request as httpsRequest } from 'node:https';
import { TLSSocket } from 'node:tls';
import type { IncomingMessage, Server } from 'node:http';
import express from 'express';
import Fastify from 'fastify';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, defineQuery } from '@cratis/arc.server';
import { mountExpress } from '../src/index.js';
import { mountFastify } from '../../Fastify/src/index.js';
import { mountHono } from '../../Hono/src/index.js';
import { cert, key } from '../../specs/tls-fixture.js';

should();
const principal = { id: 'test', name: 'Élise 🌍', roles: ['Reader'], isAuthenticated: true };
const provider = { schema: z.object({ label: z.string() }), provide: () => ({ label: 'naïve 東京' }) };

async function socket(port: number, secure: boolean, path: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: IncomingMessage['headers']; body: string }> {
    return new Promise((resolve, reject) => {
        const request = (secure ? httpsRequest : httpRequest)({ host: '127.0.0.1', port, path, method: 'GET', rejectUnauthorized: false, headers }, response => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => resolve({ status: response.statusCode!, headers: response.headers, body }));
        });
        request.on('error', reject);
        request.end();
    });
}
async function listening(server: Server): Promise<number> {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('Missing address');
    return address.port;
}
async function closed(server: Server): Promise<void> {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

describe('real identity HTTP and HTTPS sockets', () => {
    for (const host of ['Express', 'Fastify', 'Hono'] as const) {
        it(`${host} leaves me unregistered without a provider`, async () => {
            const arc = new ArcServer({});
            let server: Server;
            let close: () => Promise<void>;
            if (host === 'Express') {
                const app = express();
                mountExpress(app, arc);
                server = httpServer(app);
                close = () => closed(server);
                await listening(server);
            } else if (host === 'Fastify') {
                const app = Fastify();
                mountFastify(app, arc);
                await app.listen({ host: '127.0.0.1', port: 0 });
                server = app.server;
                close = () => app.close();
            } else {
                const app = new Hono();
                mountHono(app, arc);
                server = serve({ fetch: app.fetch, createServer: httpServer, port: 0, hostname: '127.0.0.1' }) as Server;
                close = () => closed(server);
                if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
            }
            const address = server.address();
            if (!address || typeof address === 'string') throw Error('Missing port');
            try {
                (await socket(address.port, false, '/.cratis/me')).status.should.equal(404);
                (await socket(address.port, false, '/.cratis/identity-details/schema')).body.should.equal('{}');
                (await socket(address.port, false, '/.cratis/users')).body.should.equal('[]');
            } finally { await close(); await arc.dispose(); }
        });
        it(`${host} contains native callback exceptions, even when logging rejects`, async () => {
            const correlation = 'c5aa55a1-1234-4567-890a-abcdef012345';
            const logged: unknown[] = [];
            let provided = 0;
            let executed = 0;
            const arc = new ArcServer({ nativePrincipal: true,
                identityDetails: { schema: z.object({}), provide: () => { provided++; return {}; } },
                queries: [defineQuery({ name: 'Protected', schema: z.object({}), perform: () => { executed++; return 1; } })],
                logger: (error, id) => {
                    logged.push({ error, id });
                    if (host === 'Express') throw new Error('logging failed');
                    return Promise.reject(new Error('logging failed'));
                }
            });
            const native = () => { throw Error('private native callback'); };
            let server: Server;
            let close: () => Promise<void>;
            if (host === 'Express') {
                const app = express();
                mountExpress(app, arc, native);
                server = httpServer(app);
                close = () => closed(server);
                await listening(server);
            } else if (host === 'Fastify') {
                const app = Fastify();
                mountFastify(app, arc, native);
                await app.listen({ host: '127.0.0.1', port: 0 });
                server = app.server;
                close = () => app.close();
            } else {
                const app = new Hono();
                mountHono(app, arc, native);
                server = serve({ fetch: app.fetch, createServer: httpServer, port: 0, hostname: '127.0.0.1' }) as Server;
                close = () => closed(server);
                if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
            }
            const address = server.address();
            if (!address || typeof address === 'string') throw Error('Missing port');
            try {
                for (const path of ['/.cratis/me', '/api/protected']) {
                    const result = await socket(address.port, false, path, { 'x-correlation-id': correlation });
                    result.status.should.equal(500);
                    result.headers['x-correlation-id']!.should.equal(correlation);
                    result.body.should.not.contain('private native callback');
                    result.body.should.contain('An unexpected error occurred');
                }
                provided.should.equal(0);
                executed.should.equal(0);
                logged.should.have.length(2);
                logged.every(entry => (entry as { id: string }).id === correlation).should.equal(true);
            } finally { await close(); await arc.dispose(); }
        });
        it(`${host} accepts only an explicit host-verified principal, not client headers`, async () => {
            let verified = false;
            let invalid = false;
            const arc = new ArcServer({ nativePrincipal: true, identityDetails: provider });
            const native = () => ({ principal: verified ? invalid ? { ...principal, roles: 'Reader' as unknown as readonly string[] } : principal : undefined });
            let server: Server;
            let close: () => Promise<void>;
            if (host === 'Express') {
                const app = express();
                mountExpress(app, arc, native);
                server = httpServer(app);
                close = () => closed(server);
            } else if (host === 'Fastify') {
                const app = Fastify();
                mountFastify(app, arc, native);
                await app.listen({ host: '127.0.0.1', port: 0 });
                server = app.server;
                close = () => app.close();
            } else {
                const app = new Hono();
                mountHono(app, arc, native);
                server = serve({ fetch: app.fetch, createServer: httpServer, port: 0, hostname: '127.0.0.1' }) as Server;
                close = () => closed(server);
            }
            if (host === 'Express') await listening(server);
            if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
            const address = server.address();
            if (!address || typeof address === 'string') throw Error('Missing port');
            try {
                (await socket(address.port, false, '/.cratis/me', { 'x-forwarded-user': 'test', 'x-user-id': 'test' })).status.should.equal(401);
                verified = true;
                invalid = true;
                (await socket(address.port, false, '/.cratis/me')).status.should.equal(500);
                invalid = false;
                (await socket(address.port, false, '/.cratis/me')).status.should.equal(200);
            } finally { await close(); await arc.dispose(); }
        });
        for (const secure of [false, true]) {
            it(`${host} serves conditional identity, discovery, and trusted TLS (${secure ? 'HTTPS' : 'HTTP'})`, async () => {
                let loggedIn = false;
                let denied = false;
                const arc = new ArcServer({
                    identityDetails: { schema: provider.schema, provide: () => denied ? undefined : provider.provide() },
                    authentication: [request => request.headers.get('authorization') === 'Bearer valid' && loggedIn
                        ? { status: AuthenticationStatus.Authenticated, principal }
                        : { status: AuthenticationStatus.Anonymous }],
                    queries: [defineQuery({ name: 'Tenant', schema: z.object({}), perform: (_input, context) => context.tenantId ?? 'none' })]
                });
                let server: Server;
                let close: () => Promise<void>;
                if (host === 'Express') {
                    const app = express();
                    app.use((_request, response, next) => { response.cookie('host-cache', 'present'); next(); });
                    mountExpress(app, arc);
                    app.get('/foreign', (_request, response) => response.end('other'));
                    server = secure ? httpsServer({ cert, key }, app) : httpServer(app);
                    close = () => closed(server);
                } else if (host === 'Fastify') {
                    const app = Fastify({ serverFactory: handler => secure ? httpsServer({ cert, key }, handler) : httpServer(handler) });
                    app.addHook('onRequest', (_request, reply, done) => { reply.header('set-cookie', 'host-cache=present; Path=/'); done(); });
                    mountFastify(app, arc);
                    app.get('/foreign', async () => 'other');
                    await app.listen({ host: '127.0.0.1', port: 0 });
                    server = app.server as Server;
                    close = () => app.close();
                } else {
                    const app = new Hono<{ Bindings: { incoming: IncomingMessage } }>();
                    app.use('*', async (context, next) => {
                        context.header('set-cookie', 'host-cache=present; Path=/');
                        context.header('cache-control', 'public, max-age=3600');
                        context.header('x-correlation-id', 'forged');
                        await next();
                    });
                    mountHono(app, arc, context => ({ secure: context.env.incoming.socket instanceof TLSSocket && context.env.incoming.socket.encrypted }));
                    app.get('/foreign', context => context.text('other'));
                    server = secure
                        ? serve({ fetch: app.fetch, createServer: httpsServer, serverOptions: { cert, key }, port: 0, hostname: '127.0.0.1' }) as Server
                        : serve({ fetch: app.fetch, createServer: httpServer, port: 0, hostname: '127.0.0.1' }) as Server;
                    close = () => closed(server);
                }
                const port = host === 'Fastify' ? (() => { const address = server.address(); if (!address || typeof address === 'string') throw Error('Missing address'); return address.port; })() : await (async () => {
                    if (host === 'Express') return listening(server);
                    if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
                    const address = server.address(); if (!address || typeof address === 'string') throw Error('Missing address'); return address.port;
                })();
                try {
                    (await socket(port, secure, '/.cratis/identity-details/schema')).status.should.equal(200);
                    (await socket(port, secure, '/.cratis/identity-details/schema')).body.should.contain('label');
                    (await socket(port, secure, '/.cratis/users')).body.should.equal('[]');
                    (await socket(port, secure, '/.cratis/tenants')).body.should.equal('[]');
                    (await socket(port, secure, '/.cratis/me', { cookie: `.cratis-identity=${Buffer.from('{"id":"forged"}').toString('base64')}`, 'x-forwarded-proto': 'https', 'x-forwarded-user': 'test' })).status.should.equal(401);
                    loggedIn = true;
                    denied = true;
                    (await socket(port, secure, '/.cratis/me', { authorization: 'Bearer valid' })).status.should.equal(403);
                    denied = false;
                    const response = await socket(port, secure, '/.cratis/me', { authorization: 'Bearer valid', 'x-forwarded-proto': secure ? 'http' : 'https', host: host === 'Hono' ? 'attacker.invalid' : 'malformed:host:garbage' });
                    response.status.should.equal(200);
                    response.headers['cache-control']!.should.equal('no-store');
                    response.headers['x-correlation-id']!.should.not.equal('forged');
                    const identity = JSON.parse(response.body);
                    identity.should.deep.equal({ id: 'test', name: 'Élise 🌍', roles: ['Reader'], isAuthenticated: true, isAuthorized: true, details: { label: 'naïve 東京' } });
                    const cookies = response.headers['set-cookie']!;
                    cookies.should.have.length(2);
                    const cookie = cookies.find(value => value.startsWith('.cratis-identity='))!;
                    cookie.includes('Secure').should.equal(secure);
                    cookie.should.not.contain('HttpOnly');
                    JSON.parse(atob(cookie.split(';')[0]!.split('=')[1]!)).should.deep.equal(identity);
                    Buffer.byteLength(cookie).should.be.at.most(4096);
                    (await socket(port, secure, '/.cratis/me', { cookie })).status.should.equal(401);
                    (await socket(port, secure, '/foreign')).status.should.equal(200);
                    for (const path of ['/api/%2e%2e/.cratis/me', '//.cratis/me', 'http://attacker.invalid/.cratis/me'])
                        (await socket(port, secure, path, { authorization: 'Bearer valid' })).status.should.not.equal(200);
                } finally { await close(); await arc.dispose(); }
            });
        }
    }
});

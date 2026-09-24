// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fastify from 'fastify';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { ArcServer, CurrentValueSubject, defineObservableQuery } from '@cratis/arc.server';
import { mountExpress, mountExpressWebSockets } from '@cratis/arc.server.express';
import { mountFastify, mountFastifyWebSockets } from '@cratis/arc.server.fastify';
import { mountHono, mountHonoWebSockets } from '@cratis/arc.server.hono';

const principal = { id: 'verified', isAuthenticated: true, roles: ['reader'] };
function protectedServer() {
    return new ArcServer({ nativePrincipal: true, observableQueries: [defineObservableQuery({
        name: 'Protected', schema: z.object({}), authorization: { roles: ['reader'] },
        observe: () => CurrentValueSubject.of([{ id: '1', name: 'authorized' }])
    })] });
}

async function within(promise) {
    let timer;
    try { return await Promise.race([promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Native WS authorization timed out')), 3000); })]); }
    finally { clearTimeout(timer); }
}

async function query(origin) {
    const socket = new WebSocket(`${origin.replace('http:', 'ws:')}/.cratis/queries/ws`);
    const result = new Promise(resolve => socket.addEventListener('message', event => {
        const frame = JSON.parse(event.data);
        if (frame.type === 'Connected') socket.send(JSON.stringify({ type: 'Subscribe', queryId: 'q', revision: 1,
            payload: { queryName: 'Protected' } }));
        if (frame.type === 'QueryResult' || frame.type === 'Unauthorized') resolve(frame);
    }));
    try { return await within(result); }
    finally { socket.close(); }
}

test('Express WS accepts an async native resolver without running HTTP middleware', async () => {
    const server = protectedServer();
    const app = express();
    let middlewareCalls = 0;
    let resolverCalls = 0;
    app.use((_request, _response, next) => { middlewareCalls++; next(); });
    mountExpress(app, server);
    const listener = app.listen(0, '127.0.0.1');
    await new Promise(resolve => listener.once('listening', resolve));
    mountExpressWebSockets(listener, server, async () => { resolverCalls++; await Promise.resolve(); return { principal }; });
    try {
        const frame = await query(`http://127.0.0.1:${listener.address().port}`);
        assert.equal(frame.payload.data[0].name, 'authorized');
        assert.equal(middlewareCalls, 0);
        assert.equal(resolverCalls, 1);
    } finally {
        await server.dispose();
        await new Promise(resolve => listener.close(resolve));
    }
});

test('Fastify WS runs authentication hooks before resolving the native principal', async () => {
    const server = protectedServer();
    const app = fastify();
    let hooks = 0;
    app.addHook('preValidation', async request => { hooks++; request.trustedPrincipal = principal; });
    mountFastifyWebSockets(app, server, async request => ({ principal: request.trustedPrincipal }));
    mountFastify(app, server);
    await app.listen({ port: 0, host: '127.0.0.1' });
    try {
        const frame = await query(app.listeningOrigin);
        assert.equal(frame.payload.data[0].name, 'authorized');
        assert.ok(hooks > 0);
    } finally {
        await app.close();
        assert.equal(server.services.disposed, true);
    }
});

test('Hono WS runs application middleware before resolving the native principal', async () => {
    const server = protectedServer();
    const app = new Hono();
    let hooks = 0;
    app.use('*', async (context, next) => { hooks++; context.set('trustedPrincipal', principal); await next(); });
    mountHono(app, server);
    const webSockets = mountHonoWebSockets(app, server, async context => ({ principal: context.get('trustedPrincipal') }));
    const listener = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });
    await new Promise(resolve => listener.once('listening', resolve));
    webSockets.injectWebSocket(listener);
    try {
        const frame = await query(`http://127.0.0.1:${listener.address().port}`);
        assert.equal(frame.payload.data[0].name, 'authorized');
        assert.ok(hooks > 0);
    } finally {
        await server.dispose();
        const installed = listener.listenerCount('upgrade');
        await webSockets.dispose();
        assert.equal(listener.listenerCount('upgrade'), installed - 1);
        await new Promise(resolve => listener.close(resolve));
    }
});

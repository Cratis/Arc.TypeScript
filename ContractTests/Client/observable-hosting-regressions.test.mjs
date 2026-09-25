// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fastify from 'fastify';
import websocket from '@fastify/websocket';
import { Hono } from 'hono';
import { createNodeWebSocket } from '@hono/node-ws';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import WebSocket from 'ws';
import { ArcServer, CurrentValueSubject, defineObservableQuery, runArc } from '@cratis/arc.core';
import { cratisArc as fastifyArc } from '@cratis/arc.fastify';
import { cratisArc as honoArc, createHonoWebSockets } from '@cratis/arc.hono';
import { observableHost } from './observableHost.mjs';
import { FetchEventSource } from './FetchEventSource.mjs';

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function within(promise) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('Observable hosting test timed out')), 3000);
    })]); } finally { clearTimeout(timer); }
}
const principal = { id: 'alice', isAuthenticated: true, roles: ['reader'] };

async function directResult(origin, path = '/api/numbers', options) {
    const socket = new WebSocket(`${origin.replace('http:', 'ws:')}${path}`, options);
    try {
        return await within(new Promise((resolve, reject) => {
            socket.addEventListener('message', event => resolve(JSON.parse(event.data)));
            socket.addEventListener('error', reject);
        }));
    } finally { socket.close(); }
}

test('runArc passes native principal and authority to WebSocket upgrades', async () => {
    const server = new ArcServer({ nativePrincipal: true, observableQueries: [defineObservableQuery({
        name: 'Numbers', schema: z.object({}), authorization: { roles: ['reader'] },
        observe: (_input, context) => CurrentValueSubject.of({ id: context.principal?.id, remote: context.remoteAddress })
    })] });
    let calls = 0;
    const host = await runArc(server, { port: 0, native: () => {
        calls++;
        return { principal, authority: 'app.example.com', remoteAddress: '198.51.100.8' };
    } });
    const origin = `http://127.0.0.1:${host.server.address().port}`;
    try {
        assert.equal((await (await fetch(`${origin}/api/numbers`)).json()).data.id, 'alice');
        const result = await directResult(origin, '/api/numbers', { headers: { Origin: 'http://app.example.com' } });
        assert.equal(result.data.data.id, 'alice');
        assert.equal(result.data.data.remote, '198.51.100.8');
        assert.ok(calls >= 2);
    } finally { await host.close(); await server.dispose(); }
});

test('Fastify preserves earlier plugin boot failures', async () => {
    const server = new ArcServer({});
    const app = fastify();
    app.register(async () => { throw Error('authentication plugin failed'); });
    app.register(fastifyArc, { arc: server });
    try { await assert.rejects(app.ready(), /authentication plugin failed/); }
    finally { await app.close(); await server.dispose(); }
});

test('SSE disconnect during a pending subscription produces no unhandled rejection', async () => {
    let started;
    const observing = new Promise(resolve => { started = resolve; });
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const server = new ArcServer({ nativePrincipal: true, query: { observableShutdownTimeoutMs: 30 },
        observableQueries: [defineObservableQuery({ name: 'Numbers', schema: z.object({}),
            observe: async () => { started(); await pending; return CurrentValueSubject.of([1]); }
        })] });
    const host = await observableHost('express', server, () => ({ principal }));
    const unhandled = [];
    const onUnhandled = error => { unhandled.push(error); };
    process.on('unhandledRejection', onUnhandled);
    const events = new FetchEventSource(`${host.origin}/.cratis/queries/sse`);
    let subscription;
    try {
        const connected = await within(new Promise(resolve => { events.onmessage = event => resolve(JSON.parse(event.data)); }));
        subscription = fetch(`${host.origin}/.cratis/queries/sse/subscribe`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ connectionId: connected.payload, queryId: 'pending', revision: 1,
                request: { queryName: 'Numbers' } })
        });
        await within(observing);
        events.close();
        await pause(100);
        assert.deepEqual(unhandled, []);
    } finally {
        release();
        if (subscription) await within(subscription);
        events.close();
        try { await host.close(); await server.dispose(); }
        finally { process.off('unhandledRejection', onUnhandled); }
    }
});

for (const kind of ['fastify', 'hono']) {
    test(`${kind} shared WebSocket server closes oversized direct frames with 1009`, async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => CurrentValueSubject.of([1])
        })] });
        let close;
        let origin;
        if (kind === 'fastify') {
            const app = fastify();
            app.register(websocket);
            app.register(fastifyArc, { arc: server });
            await app.listen({ port: 0, host: '127.0.0.1' });
            origin = app.listeningOrigin;
            close = () => app.close();
        } else {
            const app = new Hono();
            const helper = createNodeWebSocket({ app });
            const mounted = createHonoWebSockets(app, server, undefined, helper);
            app.use(honoArc(server));
            const listener = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });
            await new Promise(resolve => listener.once('listening', resolve));
            helper.injectWebSocket(listener);
            origin = `http://127.0.0.1:${listener.address().port}`;
            close = async () => { await mounted.dispose(); await new Promise(resolve => listener.close(resolve)); };
        }
        const socket = new WebSocket(`${origin.replace('http:', 'ws:')}/api/numbers`);
        try {
            await within(new Promise(resolve => socket.addEventListener('open', resolve)));
            const closed = new Promise(resolve => socket.addEventListener('close', event => resolve(event.code)));
            socket.send('x'.repeat(70_000));
            assert.equal(await within(closed), 1009);
        } finally { socket.close(); await close(); await server.dispose(); }
    });
}

test('direct WebSocket joins time out and terminate a stalled socket', async () => {
    let started;
    const observing = new Promise(resolve => { started = resolve; });
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const server = new ArcServer({ query: { observableShutdownTimeoutMs: 40 }, observableQueries: [defineObservableQuery({
        name: 'Numbers', schema: z.object({}), observe: async () => { started(); await pending; return CurrentValueSubject.of([1]); }
    })] });
    const host = await runArc(server, { port: 0 });
    const socket = new WebSocket(`ws://127.0.0.1:${host.server.address().port}/api/numbers`);
    try {
        const closed = new Promise(resolve => socket.addEventListener('close', resolve));
        await within(observing);
        await assert.rejects(within(host.close({ timeoutMs: 1000 })), /Arc WebSocket shutdown timed out/);
        await within(closed);
        assert.equal(host.server.listening, false);
    } finally { release(); socket.close(); await server.dispose(); }
});

test('runArc stops listening and bounds direct WebSocket shutdown with a pending source', async () => {
    let started;
    const observing = new Promise(resolve => { started = resolve; });
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const server = new ArcServer({ query: { observableShutdownTimeoutMs: 150 }, observableQueries: [defineObservableQuery({
        name: 'Numbers', schema: z.object({}), observe: async () => { started(); await pending; return CurrentValueSubject.of([1]); }
    })] });
    const host = await runArc(server, { port: 0 });
    const socket = new WebSocket(`ws://127.0.0.1:${host.server.address().port}/api/numbers`);
    try {
        await within(observing);
        const closing = host.close({ timeoutMs: 50 });
        assert.equal(host.server.listening, false);
        await assert.rejects(within(closing), /shutdown timed out/);
        assert.equal(host.server.listening, false);
    } finally {
        release(); socket.close(); await server.dispose();
    }
});

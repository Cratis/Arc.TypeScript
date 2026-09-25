// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connect } from 'node:net';
import { createServer } from 'node:http';
import fastify from 'fastify';
import websocket from '@fastify/websocket';
import { Hono } from 'hono';
import { createNodeWebSocket } from '@hono/node-ws';
import { serve } from '@hono/node-server';
import { z } from 'zod';
import { ArcServer, CurrentValueSubject, createArcNodeHandler, defineObservableQuery, runArc } from '@cratis/arc.core';
import { attachNodeWebSockets } from '@cratis/arc.core/hosting';
import { cratisArc as fastifyArc } from '@cratis/arc.fastify';
import { cratisArc as honoArc, createHonoWebSockets } from '@cratis/arc.hono';
import { observableHost } from './observableHost.mjs';

const pause = duration => new Promise(resolve => setTimeout(resolve, duration));
const within = async (promise, label = 'Observable upgrade') => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), 3000);
    })]); } finally { clearTimeout(timer); }
};
const makeServer = options => new ArcServer({ ...options, observableQueries: [defineObservableQuery({
    name: 'Numbers', schema: z.object({}), observe: () => CurrentValueSubject.of([{ id: 'one' }])
})] });
const socketResult = async (origin, path) => {
    const socket = new WebSocket(`${origin.replace('http:', 'ws:')}${path}`);
    try {
        return await within(new Promise((resolve, reject) => {
            socket.addEventListener('message', event => {
                const frame = JSON.parse(event.data);
                if (frame.type === 'Data' || frame.type === 'Connected') resolve(frame);
            });
            socket.addEventListener('error', reject);
        }));
    } finally { socket.close(); }
};
const resetDuringUpgrade = async (origin, path) => {
    const port = Number(new URL(origin).port);
    const socket = connect(port, '127.0.0.1');
    socket.on('error', () => {});
    await within(new Promise(resolve => socket.once('connect', resolve)));
    socket.write(`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`);
    await pause(40);
    socket.resetAndDestroy();
    await pause(350);
};

for (const adapter of ['express', 'fastify', 'hono']) {
    test(`${adapter} survives a reset during asynchronous upgrade and still serves requests`, async () => {
        const server = makeServer();
        const host = await observableHost(adapter, server, async () => { await pause(250); return {}; });
        try {
            await resetDuringUpgrade(host.origin, '/.cratis/queries/ws');
            assert.equal((await fetch(`${host.origin}/api/numbers`)).status, 200);
            assert.equal((await socketResult(host.origin, '/.cratis/queries/ws')).type, 'Connected');
        } finally { await host.close(); await server.dispose(); }
    });
}

for (const adapter of ['express', 'fastify', 'hono']) {
    test(`${adapter} survives a reset during asynchronous Arc authentication`, async () => {
        const server = makeServer({ authentication: [async () => {
            await pause(250);
            return { status: 'anonymous' };
        }] });
        const host = await observableHost(adapter, server);
        try {
            await resetDuringUpgrade(host.origin, '/.cratis/queries/ws');
            assert.equal((await fetch(`${host.origin}/api/numbers`)).status, 200);
        } finally { await host.close(); await server.dispose(); }
    });
}

test('Fastify Arc routes coexist with an already registered websocket plugin', async () => {
    const server = makeServer();
    const app = fastify();
    app.register(websocket);
    app.register(fastifyArc, { arc: server });
    app.register(async scoped => {
        scoped.get('/mine', { websocket: true }, socket => socket.on('message', () => socket.send('mine')));
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    try {
        assert.equal((await socketResult(app.listeningOrigin, '/.cratis/queries/ws')).type, 'Connected');
        const socket = new WebSocket(`${app.listeningOrigin.replace('http:', 'ws:')}/mine`);
        try {
            const message = new Promise(resolve => socket.addEventListener('message', event => resolve(event.data)));
            await within(new Promise(resolve => socket.addEventListener('open', resolve)));
            socket.send('hello');
            assert.equal(await within(message, 'Fastify own socket'), 'mine');
        }
        finally { socket.close(); }
    } finally { await app.close(); await server.dispose(); }
});

test('Hono Arc routes share the application websocket helper without taking its listener', async () => {
    const server = makeServer();
    const app = new Hono();
    const helper = createNodeWebSocket({ app });
    app.get('/mine', helper.upgradeWebSocket(() => ({ onOpen: (_event, connection) => connection.send('mine') })));
    const arcSockets = createHonoWebSockets(app, server, undefined, helper);
    app.use(honoArc(server));
    const listener = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
    await new Promise(resolve => listener.once('listening', resolve));
    helper.injectWebSocket(listener);
    const origin = `http://127.0.0.1:${listener.address().port}`;
    try {
        assert.equal((await socketResult(origin, '/.cratis/queries/ws')).type, 'Connected');
        const socket = new WebSocket(`${origin.replace('http:', 'ws:')}/mine`);
        try { assert.equal(await within(new Promise(resolve => socket.addEventListener('message', event => resolve(event.data)))), 'mine'); }
        finally { socket.close(); }
        await arcSockets.dispose();
        assert.equal(listener.listenerCount('upgrade'), 1);
    } finally {
        await arcSockets.dispose(); await server.dispose();
        await new Promise(resolve => listener.close(resolve));
    }
});

test('Hono WebSocket route passes an ordinary GET to Arc when mounted first', async () => {
    const server = makeServer();
    const app = new Hono();
    const sockets = createHonoWebSockets(app, server);
    app.use(honoArc(server));
    const listener = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
    await new Promise(resolve => listener.once('listening', resolve));
    sockets.injectWebSocket(listener);
    try {
        const result = await fetch(`http://127.0.0.1:${listener.address().port}/api/numbers`);
        assert.equal(result.status, 200);
        assert.equal((await result.json()).data[0].id, 'one');
    } finally {
        await sockets.dispose(); await server.dispose();
        await new Promise(resolve => listener.close(resolve));
    }
});

for (const hosted of ['runArc', 'createArcNodeHandler']) {
    test(`${hosted} serves direct and hub WebSockets on the standalone listener`, async () => {
        const server = makeServer();
        const host = hosted === 'runArc' ? await runArc(server, { port: 0, pathBase: '/app' }) : undefined;
        const listener = host?.server ?? createServer(createArcNodeHandler(server, { pathBase: '/app' }));
        const dispose = host ? undefined : attachNodeWebSockets(listener, server, undefined, '/app');
        if (!host) await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
        const origin = `http://127.0.0.1:${listener.address().port}`;
        try {
            assert.equal((await socketResult(origin, '/app/.cratis/queries/ws')).type, 'Connected');
            assert.equal((await socketResult(origin, '/app/api/numbers')).type, 'Data');
        } finally {
            if (host) await host.close();
            else { await dispose(); await new Promise(resolve => listener.close(resolve)); }
            await server.dispose();
        }
    });
}

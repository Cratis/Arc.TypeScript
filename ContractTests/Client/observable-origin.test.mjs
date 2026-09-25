// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, CurrentValueSubject, defineObservableQuery } from '@cratis/arc.core';
import { observableHost } from './observableHost.mjs';

async function within(promise) {
    let timer;
    try { return await Promise.race([promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Upgrade or control timed out')), 3000); })]); }
    finally { clearTimeout(timer); }
}

function fixture(options = {}) {
    return new ArcServer({ ...options,
        authentication: [request => request.headers.get('authorization') === 'Bearer alice'
            ? { status: AuthenticationStatus.Authenticated, principal: { id: 'alice', isAuthenticated: true, roles: [] } }
            : { status: request.headers.get('authorization') === 'Bearer bad'
                ? AuthenticationStatus.Failed : AuthenticationStatus.Anonymous }],
        observableQueries: [defineObservableQuery({ name: 'Numbers', schema: z.object({}),
            observe: () => CurrentValueSubject.of([1]) })]
    });
}

async function upgrade(origin, path, browserOrigin, headers = {}) {
    return within(new Promise((resolve, reject) => {
        const socket = new WebSocket(`${origin.replace('http:', 'ws:')}${path}`, {
            origin: browserOrigin, headers, handshakeTimeout: 2000
        });
        socket.once('open', () => { socket.close(); resolve(101); });
        socket.once('unexpected-response', (request, response) => {
            resolve(response.statusCode);
            response.resume();
            request.destroy();
            response.socket.destroy();
        });
        socket.once('error', reject);
    }));
}

async function openSse(origin, browserOrigin) {
    const response = await fetch(`${origin}/.cratis/queries/sse`, {
        headers: { authorization: 'Bearer alice', origin: browserOrigin }
    });
    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    const connected = JSON.parse(new TextDecoder().decode((await reader.read()).value).slice(6));
    return { reader, connectionId: connected.payload };
}

async function subscribe(origin, connectionId, browserOrigin) {
    return fetch(`${origin}/.cratis/queries/sse/subscribe`, { method: 'POST',
        headers: { authorization: 'Bearer alice', 'content-type': 'application/json', origin: browserOrigin },
        body: JSON.stringify({ connectionId, queryId: 'q', revision: 1, request: { queryName: 'Numbers' } })
    });
}

for (const kind of ['express', 'fastify', 'hono']) {
    test(`default same-origin WS and SSE control reject cross-origin on ${kind}`, async () => {
        const server = fixture();
        const listening = await observableHost(kind, server);
        try {
            const path = '/.cratis/queries/ws';
            assert.equal(await upgrade(listening.origin, path, listening.origin, { authorization: 'Bearer alice' }), 101);
            assert.equal(await upgrade(listening.origin, path, 'https://evil.example', { authorization: 'Bearer alice' }), 403);
            assert.equal(await upgrade(listening.origin, '/not-arc', listening.origin), 404);
            assert.equal(await upgrade(listening.origin, '/api/%6eumbers', listening.origin), 404);
            assert.equal(await upgrade(listening.origin, '/openapi.json', listening.origin), kind === 'hono' ? 404 : 426);
            assert.equal(await upgrade(listening.origin, '/api/numbers?unknown=1', listening.origin), 400);
            assert.equal(await upgrade(listening.origin, path, listening.origin,
                { authorization: 'Bearer bad' }), 401);
            const sse = await openSse(listening.origin, listening.origin);
            try {
                assert.equal((await subscribe(listening.origin, sse.connectionId, 'https://evil.example')).status, 403);
                assert.equal((await subscribe(listening.origin, sse.connectionId, listening.origin)).status, 200);
            } finally { await sse.reader.cancel(); }
        } finally { await server.dispose(); await listening.close(); }
    });

    test(`trusted TLS proxy metadata authorizes browser Origins on ${kind}`, async () => {
        const server = fixture();
        const native = async () => ({ secure: true, authority: 'app.example.com' });
        const listening = await observableHost(kind, server, native);
        try {
            const path = '/.cratis/queries/ws';
            assert.equal(await upgrade(listening.origin, path, 'https://app.example.com',
                { authorization: 'Bearer alice' }), 101);
            assert.equal(await upgrade(listening.origin, path, listening.origin,
                { authorization: 'Bearer alice' }), 403);
            const sse = await openSse(listening.origin, 'https://app.example.com');
            try {
                assert.equal((await subscribe(listening.origin, sse.connectionId, listening.origin)).status, 403);
                assert.equal((await subscribe(listening.origin, sse.connectionId, 'https://app.example.com')).status, 200);
            } finally { await sse.reader.cancel(); }
        } finally { await server.dispose(); await listening.close(); }
    });
}

test('upgrade admission and handshake timeout answer with HTTP statuses', async () => {
    const limited = fixture({ query: { maxObservableHubConnections: 1 } });
    const listener = await observableHost('express', limited);
    const socket = new WebSocket(`${listener.origin.replace('http:', 'ws:')}/.cratis/queries/ws`);
    try {
        await within(new Promise(resolve => socket.once('open', resolve)));
        assert.equal(await upgrade(listener.origin, '/.cratis/queries/ws', listener.origin), 503);
    } finally { socket.close(); await limited.dispose(); await listener.close(); }
    for (const kind of ['express', 'fastify', 'hono']) {
        const slow = fixture({ query: { observableHandshakeTimeoutMs: 10 } });
        const hosting = await observableHost(kind, slow, async () => new Promise(() => {}));
        try {
            assert.equal(await upgrade(hosting.origin, '/.cratis/queries/ws', hosting.origin), 408);
        } finally { await slow.dispose(); await hosting.close(); }
    }
});

test('explicit Origin allow-list and async predicate support development proxies', async () => {
    for (const allowedOrigins of [
        ['http://localhost:5173'],
        async origin => origin === 'http://localhost:5173'
    ]) {
        const server = fixture({ query: { allowedOrigins } });
        const listening = await observableHost('express', server);
        try {
            assert.equal(await upgrade(listening.origin, '/.cratis/queries/ws', 'http://localhost:5173',
                { authorization: 'Bearer alice' }), 101);
            assert.equal(await upgrade(listening.origin, '/.cratis/queries/ws', 'http://untrusted.example',
                { authorization: 'Bearer alice' }), 403);
            const sse = await openSse(listening.origin, 'http://localhost:5173');
            try {
                assert.equal((await subscribe(listening.origin, sse.connectionId, 'http://localhost:5173')).status, 200);
            } finally { await sse.reader.cancel(); }
        } finally { await server.dispose(); await listening.close(); }
    }
});

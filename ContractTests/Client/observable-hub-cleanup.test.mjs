// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, CurrentValueSubject, defineObservableQuery } from '@cratis/arc.server';
import { observableHost } from './observableHost.mjs';
import { FetchEventSource } from './FetchEventSource.mjs';

async function within(promise) {
    let timer;
    try { return await Promise.race([promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Observable hub shutdown timed out')), 3000); })]); }
    finally { clearTimeout(timer); }
}

for (const kind of ['express', 'fastify', 'hono']) test(`hub disconnect and shutdown release ${kind} subscriptions`, async () => {
    const subject = new CurrentValueSubject([{ id: '1' }]);
    let active = 0;
    const tracked = {
        subscribe(observer) {
            active++;
            const subscription = subject.subscribe(observer);
            return { unsubscribe() { active--; subscription.unsubscribe(); } };
        }
    };
    const server = new ArcServer({ authentication: [request => request.headers.get('authorization') === 'Bearer alice'
        ? { status: AuthenticationStatus.Authenticated, principal: { id: 'alice', isAuthenticated: true, roles: [] } }
        : { status: AuthenticationStatus.Anonymous }],
    observableQueries: [defineObservableQuery({ name: 'Numbers', schema: z.object({}), observe: () => tracked })] });
    const listening = await observableHost(kind, server);
    const socket = new WebSocket(`${listening.origin.replace('http:', 'ws:')}/.cratis/queries/ws`);
    let events;
    try {
        const connected = await within(new Promise(resolve => socket.addEventListener('message', event => {
            const message = JSON.parse(event.data);
            if (message.type === 'Connected') resolve(message);
        })));
        assert.equal(connected.type, 'Connected');
        const wsResult = new Promise(resolve => socket.addEventListener('message', event => {
            const message = JSON.parse(event.data);
            if (message.type === 'QueryResult') resolve(message);
        }));
        socket.send(JSON.stringify({ type: 'Subscribe', queryId: 'ws', revision: 1, payload: { queryName: 'Numbers' } }));
        assert.equal((await within(wsResult)).queryId, 'ws');
        const url = `${listening.origin}/.cratis/queries/sse`;
        events = new FetchEventSource(url, { authorization: 'Bearer alice' });
        const sseConnected = await within(new Promise(resolve => { events.onmessage = event => resolve(JSON.parse(event.data)); }));
        const sseResult = new Promise(resolve => { events.onmessage = event => resolve(JSON.parse(event.data)); });
        const response = await fetch(`${url}/subscribe`, { method: 'POST',
            headers: { authorization: 'Bearer alice', 'content-type': 'application/json' },
            body: JSON.stringify({ connectionId: sseConnected.payload, queryId: 'sse', revision: 1,
                request: { queryName: 'Numbers' } }) });
        assert.equal(response.status, 200);
        assert.equal((await within(sseResult)).queryId, 'sse');
        assert.equal(active, 2);
        await within(server.dispose());
        assert.equal(active, 0);
    } finally {
        events?.close();
        socket.close();
        await server.dispose();
        await listening.close();
    }
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, CurrentValueSubject, defineObservableQuery } from '@cratis/arc.core';
import { observableHost } from './observableHost.mjs';
import { FetchEventSource } from './FetchEventSource.mjs';

async function within(promise, label) {
    let timer;
    try { return await Promise.race([promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), 4000); })]); }
    finally { clearTimeout(timer); }
}

test('SSE unsubscribe answers 200 despite one producer ignoring cancellation', async () => {
    let enteredWait;
    const waiting = new Promise(resolve => { enteredWait = resolve; });
    const other = CurrentValueSubject.of([{ id: 'other', name: 'first' }]);
    const server = new ArcServer({ authentication: [request => request.headers.get('cookie')?.includes('arc-session=alice')
        ? { status: AuthenticationStatus.Authenticated, principal: { id: 'alice', roles: [], isAuthenticated: true } }
        : { status: AuthenticationStatus.Anonymous }],
    observableQueries: [
        defineObservableQuery({ name: 'Slow', schema: z.object({}), observe: () => (async function* () {
            yield [{ id: 'slow' }];
            enteredWait();
            await new Promise(resolve => setTimeout(resolve, 2000));
        })() }),
        defineObservableQuery({ name: 'Other', schema: z.object({}), observe: () => other })
    ] });
    const listening = await observableHost('express', server);
    const url = `${listening.origin}/.cratis/queries/sse`;
    const events = new FetchEventSource(url, { cookie: 'arc-session=alice' });
    const frames = [];
    const listeners = [];
    events.onmessage = event => {
        const frame = JSON.parse(event.data);
        frames.push(frame);
        for (const listener of listeners) listener(frame);
    };
    const resultFor = (queryId, name) => within(new Promise(resolve => {
        const found = frames.find(frame => frame.type === 'QueryResult' && frame.queryId === queryId &&
            frame.payload.data?.[0]?.name === name);
        if (found) { resolve(found); return; }
        listeners.push(frame => {
            if (frame.type === 'QueryResult' && frame.queryId === queryId &&
                frame.payload.data?.[0]?.name === name) resolve(frame);
        });
    }), queryId);
    const headers = { cookie: 'arc-session=alice', 'content-type': 'application/json' };
    let disposed = false;
    try {
        const connected = await within(new Promise(resolve => listeners.push(frame => {
            if (frame.type === 'Connected') resolve(frame);
        })), 'SSE Connected');
        const control = (path, queryId, revision, request) => fetch(`${url}/${path}`, { method: 'POST', headers,
            body: JSON.stringify({ connectionId: connected.payload, queryId, revision, ...(request ? { request } : {}) }) });
        assert.equal((await control('subscribe', 'slow', 1, { queryName: 'Slow' })).status, 200);
        await within(waiting, 'Slow producer wait');
        assert.equal((await control('subscribe', 'other', 2, { queryName: 'Other' })).status, 200);
        await resultFor('other', 'first');
        assert.equal((await control('unsubscribe', 'slow', 1)).status, 200);
        other.next([{ id: 'other', name: 'later' }]);
        assert.equal((await resultFor('other', 'later')).payload.data[0].name, 'later');
        await server.dispose();
        disposed = true;
    } finally {
        events.close();
        if (!disposed) await server.dispose();
        await listening.close();
    }
});

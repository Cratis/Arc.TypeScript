// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { ArcServer, CurrentValueSubject, defineObservableQuery } from '@cratis/arc.core';
import { observableHost } from './observableHost.mjs';

async function within(promise, label) {
    let timer;
    try { return await Promise.race([promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), 4000); })]); }
    finally { clearTimeout(timer); }
}

test('a slow-to-cancel source fails only its own hub subscription', async () => {
    let enteredWait;
    const waiting = new Promise(resolve => { enteredWait = resolve; });
    let failedCleanup;
    const logged = new Promise(resolve => { failedCleanup = resolve; });
    const other = CurrentValueSubject.of([{ id: 'other', name: 'first' }]);
    const server = new ArcServer({ logger: error => {
        if (String(error).includes('cancel') || String(error).includes('cleanup')) failedCleanup(error);
    }, observableQueries: [
        defineObservableQuery({ name: 'Slow', schema: z.object({}), observe: () => (async function* () {
            yield [{ id: 'slow' }];
            enteredWait();
            await new Promise(resolve => setTimeout(resolve, 2000));
        })() }),
        defineObservableQuery({ name: 'Other', schema: z.object({}), observe: () => other })
    ] });
    const listening = await observableHost('express', server);
    const socket = new WebSocket(`${listening.origin.replace('http:', 'ws:')}/.cratis/queries/ws`);
    const frames = [];
    const listeners = [];
    socket.addEventListener('message', event => {
        const frame = JSON.parse(event.data);
        frames.push(frame);
        for (const listener of listeners) listener(frame);
    });
    const resultFor = queryId => {
        const existing = frames.find(frame => frame.type === 'QueryResult' && frame.queryId === queryId);
        if (existing) return Promise.resolve(existing);
        return new Promise(resolve => listeners.push(frame => {
            if (frame.type === 'QueryResult' && frame.queryId === queryId) resolve(frame);
        }));
    };
    let disposed = false;
    try {
        await within(new Promise(resolve => socket.addEventListener('open', resolve, { once: true })), 'Hub opening');
        socket.send(JSON.stringify({ type: 'Subscribe', queryId: 'slow', revision: 1, payload: { queryName: 'Slow' } }));
        socket.send(JSON.stringify({ type: 'Subscribe', queryId: 'other', revision: 1, payload: { queryName: 'Other' } }));
        await within(resultFor('slow'), 'Slow first result');
        await within(resultFor('other'), 'Other first result');
        await within(waiting, 'Slow producer wait');
        socket.send(JSON.stringify({ type: 'Unsubscribe', queryId: 'slow', revision: 1 }));
        await within(logged, 'Canceled source failure');
        assert.equal(socket.readyState, WebSocket.OPEN);
        other.next([{ id: 'other', name: 'later' }]);
        const later = await within(new Promise(resolve => listeners.push(frame => {
            if (frame.type === 'QueryResult' && frame.queryId === 'other' &&
                frame.payload.data?.[0]?.name === 'later') resolve(frame);
        })), 'Other subscription update');
        assert.equal(later.payload.data[0].name, 'later');
        assert.equal(frames.some(frame => frame.type === 'Error' && frame.payload === 'Malformed query control'), false);
        await assert.rejects(server.dispose(), /Observable query shutdown failed/);
        disposed = true;
    } finally {
        socket.close();
        if (!disposed) await server.dispose();
        await listening.close();
    }
});

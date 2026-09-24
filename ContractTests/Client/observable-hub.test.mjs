// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, CurrentValueSubject, ObservableEmissionDecision,
    defineObservableQuery, serviceToken } from '@cratis/arc.core';
import { Globals } from '@cratis/arc';
import { ObservableQueryFor, QueryTransportMethod, resetSharedMultiplexer } from '@cratis/arc/queries';
import { observableHost } from './observableHost.mjs';
import { FetchEventSource } from './FetchEventSource.mjs';

async function within(promise, label) {
    let timer;
    try {
        return await Promise.race([promise,
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), 3000); })]);
    } finally { clearTimeout(timer); }
}

function frames(socket) {
    const buffered = [];
    const readers = [];
    socket.addEventListener('message', event => {
        const frame = JSON.parse(event.data);
        if (readers.length) readers.shift()(frame);
        else buffered.push(frame);
    });
    return { next: () => buffered.length ? Promise.resolve(buffered.shift()) : new Promise(resolve => readers.push(resolve)) };
}

for (const kind of ['express', 'fastify', 'hono']) test(`raw observable hubs on ${kind}`, async () => {
    const subject = new CurrentValueSubject([{ id: '1', name: 'first' }]);
    const scalar = new CurrentValueSubject(0);
    let observed = 0;
    let privateObserved = 0;
    const server = new ArcServer({ authentication: [request => {
        const id = request.headers.get('authorization') ??
            (request.headers.get('cookie')?.includes('arc-session=alice') ? 'Bearer alice' :
                request.headers.get('cookie')?.includes('arc-session=bob') ? 'Bearer bob' : null);
        return id === 'Bearer alice' || id === 'Bearer bob'
            ? { status: AuthenticationStatus.Authenticated, principal: {
                id: id.slice(7), isAuthenticated: true, roles: ['reader'] } }
            : { status: AuthenticationStatus.Anonymous };
    }], observableQueries: [
        defineObservableQuery({ name: 'Numbers', schema: z.object({}), observe: () => { observed++; return subject; } }),
        defineObservableQuery({ name: 'Private', schema: z.object({}), authorization: { roles: ['admin'] },
            observe: () => { privateObserved++; return subject; } }),
        defineObservableQuery({ name: 'Count', schema: z.object({}), observe: () => scalar })
    ] });
    const listening = await observableHost(kind, server);
    const socket = new WebSocket(`${listening.origin.replace('http:', 'ws:')}/.cratis/queries/ws`);
    const received = frames(socket);
    let events;
    try {
        const connected = await within(received.next(), 'WS Connected');
        assert.equal(connected.type, 'Connected');
        assert.equal(connected.supportsSubscriptionRevisions, true);
        assert.equal(typeof connected.payload, 'string');
        socket.send(JSON.stringify({ type: 'Subscribe', queryId: 'q', revision: 1,
            payload: { queryName: 'Numbers', transferMode: 'full' } }));
        const first = await within(received.next(), 'WS first result');
        assert.equal(first.type, 'QueryResult');
        assert.equal(first.revision, 1);
        assert.equal(first.payload.data[0].name, 'first');
        socket.send(JSON.stringify({ type: 'Subscribe', queryId: 'q', revision: 1,
            payload: { queryName: 'Numbers', transferMode: 'full' } }));
        socket.send(JSON.stringify({ type: 'Subscribe', queryId: 'q',
            payload: { queryName: 'Numbers', transferMode: 'full' } }));
        socket.send(JSON.stringify({ type: 'Ping', timestamp: 91 }));
        const pong = await within(received.next(), 'WS ordering barrier');
        assert.equal(pong.type, 'Pong');
        assert.equal(pong.timestamp, 91);
        assert.equal(observed, 1);
        socket.send(JSON.stringify({ type: 'Unsubscribe', queryId: 'late', revision: 3 }));
        socket.send(JSON.stringify({ type: 'Subscribe', queryId: 'late', revision: 3,
            payload: { queryName: 'Numbers' } }));
        socket.send(JSON.stringify({ type: 'Ping', timestamp: 92 }));
        assert.equal((await within(received.next(), 'WS tombstone barrier')).timestamp, 92);
        assert.equal(observed, 1);
        socket.send(JSON.stringify({ type: 'Subscribe', queryId: 'private', revision: 1,
            payload: { queryName: 'Private' } }));
        const denied = await within(received.next(), 'WS Unauthorized');
        assert.equal(denied.type, 'Unauthorized');
        assert.equal(denied.revision, 1);
        assert.equal(privateObserved, 0);
        socket.send(JSON.stringify({ type: 'Unsubscribe', queryId: 'q', revision: 1 }));
        socket.send(JSON.stringify({ type: 'Subscribe', queryId: 'delta', revision: 4,
            payload: { queryName: 'Numbers', transferMode: 'delta' } }));
        const initialDelta = await within(received.next(), 'WS initial delta');
        assert.equal(initialDelta.payload.data[0].name, 'first');
        assert.equal(initialDelta.payload.changeSet, undefined);
        subject.next([{ id: '1', name: 'second' }, { id: '2', name: 'added' }]);
        const delta = await within(received.next(), 'WS delta update');
        assert.equal(delta.type, 'QueryResult');
        assert.equal(delta.payload.data, undefined);
        assert.deepEqual(delta.payload.changeSet.added, [{ id: '2', name: 'added' }]);
        assert.deepEqual(delta.payload.changeSet.replaced, [{ id: '1', name: 'second' }]);
        socket.send(JSON.stringify({ type: 'Unsubscribe', queryId: 'delta', revision: 4 }));
        socket.send(JSON.stringify({ type: 'Ping', timestamp: 93 }));
        assert.equal((await within(received.next(), 'WS unsubscribe barrier')).timestamp, 93);
        socket.send(JSON.stringify({ type: 'Subscribe', queryId: 'scalar', revision: 1,
            payload: { queryName: 'Count', transferMode: 'delta' } }));
        const scalarFirst = await within(received.next(), 'WS scalar first');
        assert.equal(scalarFirst.payload.data, 0);
        scalar.next(1);
        const scalarNext = await within(received.next(), 'WS scalar next');
        assert.equal(scalarNext.payload.data, 1);
        assert.equal(scalarNext.payload.changeSet, undefined);
        socket.send(JSON.stringify({ type: 'Unsubscribe', queryId: 'scalar', revision: 1 }));
        subject.next([{ id: '1', name: 'first' }]);
        const origin = `${listening.origin}/.cratis/queries/sse`;
        events = new FetchEventSource(origin, { cookie: 'arc-session=alice' });
        const sse = new Promise(resolve => { events.onmessage = event => resolve(JSON.parse(event.data)); });
        const sseConnected = await within(sse, 'SSE Connected');
        assert.equal(sseConnected.type, 'Connected');
        assert.equal(sseConnected.supportsSubscriptionRevisions, true);
        const subscribeUrl = `${origin}/subscribe`;
        const payload = { connectionId: sseConnected.payload, queryId: 's', revision: 2,
            request: { queryName: 'Numbers' } };
        const wrong = await fetch(subscribeUrl, { method: 'POST', headers: { cookie: 'arc-session=bob',
            'content-type': 'application/json' }, body: JSON.stringify(payload) });
        assert.equal(wrong.status, 404);
        const otherTenant = await fetch(subscribeUrl, { method: 'POST',
            headers: { cookie: 'arc-session=alice', 'content-type': 'application/json',
                'x-cratis-tenant-id': 'other-tenant' }, body: JSON.stringify(payload) });
        assert.equal(otherTenant.status, 404);
        const unknown = await fetch(subscribeUrl, { method: 'POST',
            headers: { cookie: 'arc-session=alice', 'content-type': 'application/json' },
            body: JSON.stringify({ ...payload, connectionId: crypto.randomUUID() }) });
        assert.equal(unknown.status, 404);
        const invalidRevision = await fetch(subscribeUrl, { method: 'POST',
            headers: { cookie: 'arc-session=alice', 'content-type': 'application/json' },
            body: JSON.stringify({ ...payload, revision: 0 }) });
        assert.equal(invalidRevision.status, 400);
        const unsafeContentType = await fetch(subscribeUrl, { method: 'POST',
            headers: { cookie: 'arc-session=alice', 'content-type': 'text/plain' },
            body: JSON.stringify(payload) });
        assert.equal(unsafeContentType.status, 415);
        const next = new Promise(resolve => { events.onmessage = event => resolve(JSON.parse(event.data)); });
        const accepted = await fetch(subscribeUrl, { method: 'POST',
            headers: { cookie: 'arc-session=alice', 'content-type': 'application/json' },
            body: JSON.stringify(payload) });
        assert.equal(accepted.status, 200);
        const result = await within(next, 'SSE result');
        assert.equal(result.type, 'QueryResult');
        assert.equal(result.queryId, 's');
        assert.equal(result.revision, 2);
        assert.equal(result.payload.data[0].name, 'first');
        assert.deepEqual(result.payload.changeSet.added, [{ id: '1', name: 'first' }]);
        const later = new Promise(resolve => { events.onmessage = event => resolve(JSON.parse(event.data)); });
        subject.next([{ id: '1', name: 'third' }]);
        const legacy = await within(later, 'SSE legacy update');
        assert.equal(legacy.payload.data[0].name, 'third');
        assert.deepEqual(legacy.payload.changeSet.replaced, [{ id: '1', name: 'third' }]);
        const unsubscribe = await fetch(`${origin}/unsubscribe`, { method: 'POST',
            headers: { cookie: 'arc-session=alice', 'content-type': 'application/json' },
            body: JSON.stringify({ connectionId: sseConnected.payload, queryId: 's', revision: 2 }) });
        assert.equal(unsubscribe.status, 200);
        const unauthorizedFrame = new Promise(resolve => { events.onmessage = event => resolve(JSON.parse(event.data)); });
        const unauthorized = await fetch(subscribeUrl, { method: 'POST',
            headers: { cookie: 'arc-session=alice', 'content-type': 'application/json' },
            body: JSON.stringify({ ...payload, queryId: 'private', revision: 3,
                request: { queryName: 'Private' } }) });
        assert.equal(unauthorized.status, 401);
        assert.equal((await within(unauthorizedFrame, 'SSE Unauthorized')).type, 'Unauthorized');
        assert.equal(privateObserved, 0);
    } finally {
        events?.close();
        socket.close();
        await server.dispose();
        await listening.close();
    }
});

test('a delayed legacy subscribe cannot emit after a revision-aware replacement', async () => {
    const subject = new CurrentValueSubject([{ id: '1', name: 'current' }]);
    let releaseFirst;
    let firstStarted;
    const blocked = new Promise(resolve => { releaseFirst = resolve; });
    const started = new Promise(resolve => { firstStarted = resolve; });
    let calls = 0;
    const server = new ArcServer({ observableQueries: [defineObservableQuery({
        name: 'Numbers', schema: z.object({}), observe: async () => {
            if (++calls === 1) { firstStarted(); await blocked; }
            return subject;
        }
    })] });
    const listening = await observableHost('express', server);
    const socket = new WebSocket(`${listening.origin.replace('http:', 'ws:')}/.cratis/queries/ws`);
    const received = frames(socket);
    try {
        assert.equal((await within(received.next(), 'Connected')).type, 'Connected');
        socket.send(JSON.stringify({ type: 'Subscribe', queryId: 'q', payload: { queryName: 'Numbers' } }));
        await within(started, 'Legacy source opening');
        socket.send(JSON.stringify({ type: 'Subscribe', queryId: 'q', revision: 1,
            payload: { queryName: 'Numbers' } }));
        const current = await within(received.next(), 'Revision-aware replacement');
        assert.equal(current.type, 'QueryResult');
        assert.equal(current.revision, 1);
        releaseFirst();
        await new Promise(resolve => setImmediate(resolve));
        socket.send(JSON.stringify({ type: 'Ping', timestamp: 44 }));
        assert.equal((await within(received.next(), 'Stale callback barrier')).type, 'Pong');
        assert.equal(calls, 2);
    } finally {
        releaseFirst();
        socket.close();
        await server.dispose();
        await listening.close();
    }
});

test('hub delta baseline ignores suppressed emissions', async () => {
    const subject = new CurrentValueSubject([{ id: '1', name: 'first' }]);
    const guard = serviceToken('suppress second');
    const observed = [];
    const server = new ArcServer({ services: [{ token: guard, lifetime: 'scoped', factory: () => ({
        check(emission) {
            observed.push(emission.isFirstEmission);
            return emission.data[0]?.name === 'suppressed'
                ? ObservableEmissionDecision.Suppress : ObservableEmissionDecision.Allow;
        }
    }) }], observableEmissionGuards: [guard], observableQueries: [defineObservableQuery({
        name: 'Numbers', schema: z.object({}), observe: () => subject
    })] });
    const listening = await observableHost('express', server);
    const socket = new WebSocket(`${listening.origin.replace('http:', 'ws:')}/.cratis/queries/ws`);
    const received = frames(socket);
    try {
        assert.equal((await within(received.next(), 'Connected')).type, 'Connected');
        socket.send(JSON.stringify({ type: 'Subscribe', queryId: 'q', revision: 1,
            payload: { queryName: 'Numbers', transferMode: 'delta' } }));
        const first = await within(received.next(), 'Initial snapshot');
        assert.equal(first.payload.data[0].name, 'first');
        subject.next([{ id: '1', name: 'suppressed' }]);
        subject.next([{ id: '1', name: 'third' }]);
        const next = await within(received.next(), 'After suppressed update');
        assert.equal(next.payload.data, undefined);
        assert.deepEqual(next.payload.changeSet.replaced, [{ id: '1', name: 'third' }]);
        assert.deepEqual(observed, [true, false, false]);
    } finally {
        socket.close();
        await server.dispose();
        await listening.close();
    }
});

class Numbers extends ObservableQueryFor {
    constructor() { super(Object, true); }
    route = '/api/numbers';
    queryName = 'Numbers';
    defaultValue = [];
    parameterDescriptors = [];
    get requiredRequestParameters() { return []; }
}

for (const kind of ['express', 'fastify', 'hono']) {
    for (const [method, mode] of [
        [QueryTransportMethod.WebSocket, 'full'], [QueryTransportMethod.WebSocket, 'delta'],
        [QueryTransportMethod.ServerSentEvents, 'full'], [QueryTransportMethod.ServerSentEvents, 'delta']
    ]) {
        test(`installed client receives ${method} ${mode} hub updates on ${kind}`, async () => {
            const subject = new CurrentValueSubject([{ id: '1', name: 'first' }]);
            let active = 0;
            const released = [];
            const tracked = {
                current: () => subject.current(),
                subscribe(observer) {
                    active++;
                    const subscription = subject.subscribe(observer);
                    return { unsubscribe() {
                        subscription.unsubscribe();
                        active--;
                        if (active === 0) for (const waiter of released.splice(0)) waiter();
                    } };
                }
            };
            const server = new ArcServer({ authentication: [request =>
                request.headers.get('authorization') === 'Bearer alice' || request.headers.get('cookie')?.includes('arc-session=alice')
                ? { status: AuthenticationStatus.Authenticated, principal: { id: 'alice', isAuthenticated: true, roles: ['reader'] } }
                : { status: AuthenticationStatus.Anonymous }],
            observableQueries: [defineObservableQuery({ name: 'Numbers', schema: z.object({}), observe: () => tracked })] });
            const listening = await observableHost(kind, server);
            const previous = { direct: Globals.queryDirectMode, method: Globals.queryTransportMethod,
                mode: Globals.observableQueryTransferMode, factory: Globals.eventSourceFactory,
                headers: Globals.httpHeadersCallback, eventSource: globalThis.EventSource, fetch: globalThis.fetch };
            let unsubscribeFinished;
            let subscription;
            try {
                Globals.queryDirectMode = false;
                Globals.queryTransportMethod = method;
                Globals.observableQueryTransferMode = mode;
                if (method === QueryTransportMethod.ServerSentEvents) {
                    globalThis.EventSource = FetchEventSource;
                    Globals.eventSourceFactory = url => new FetchEventSource(url, { cookie: 'arc-session=alice' });
                    Globals.httpHeadersCallback = () => ({ Cookie: 'arc-session=alice' });
                    unsubscribeFinished = new Promise(resolve => {
                        globalThis.fetch = (url, options) => {
                            const response = previous.fetch(url, options);
                            if (String(url).endsWith('/sse/unsubscribe')) void response.then(resolve, resolve);
                            return response;
                        };
                    });
                }
                const query = new Numbers();
                query.setOrigin(listening.origin);
                let firstReceived;
                let updateReceived;
                const initial = new Promise(resolve => { firstReceived = resolve; });
                const updated = new Promise(resolve => { updateReceived = resolve; });
                subscription = query.subscribe(result => {
                    if (result.data?.[0]?.name === 'first') firstReceived(result);
                    if (result.data?.[0]?.name === 'second' ||
                        result.changeSet?.replaced?.some(item => item.name === 'second')) updateReceived(result);
                });
                assert.equal((await within(initial, `${method} initial`)).isAuthorized, true);
                subject.next([{ id: '1', name: 'second' }]);
                const change = await within(updated, `${method} update`);
                if (mode === 'delta') {
                    assert.deepEqual(change.data, []); // The installed callback does not reconstruct delta-only data.
                    assert.equal(change.changeSet.replaced[0].name, 'second');
                } else assert.equal(change.data[0].name, 'second');
                subscription.unsubscribe();
                await within(active === 0 ? Promise.resolve() : new Promise(resolve => { released.push(resolve); }),
                    `${method} source release`);
                assert.equal(active, 0);
                if (unsubscribeFinished) await within(unsubscribeFinished, 'SSE hub unsubscribe POST');
            } finally {
                subscription?.unsubscribe();
                resetSharedMultiplexer();
                Globals.queryDirectMode = previous.direct;
                Globals.queryTransportMethod = previous.method;
                Globals.observableQueryTransferMode = previous.mode;
                Globals.eventSourceFactory = previous.factory;
                Globals.httpHeadersCallback = previous.headers;
                globalThis.fetch = previous.fetch;
                if (previous.eventSource === undefined) delete globalThis.EventSource;
                else globalThis.EventSource = previous.eventSource;
                await server.dispose();
                await listening.close();
            }
        });
    }
}

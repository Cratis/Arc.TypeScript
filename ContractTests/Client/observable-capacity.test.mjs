// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { Globals } from '@cratis/arc';
import { ObservableQueryFor, QueryTransportMethod, resetSharedMultiplexer } from '@cratis/arc/queries';
import { ArcServer, AuthenticationStatus, CurrentValueSubject, defineObservableQuery } from '@cratis/arc.core';
import { observableHost } from './observableHost.mjs';
import { FetchEventSource } from './FetchEventSource.mjs';

class Numbers extends ObservableQueryFor {
    constructor() { super(Object, true); }
    route = '/api/numbers';
    queryName = 'Numbers';
    defaultValue = [];
    parameterDescriptors = [];
    get requiredRequestParameters() { return []; }
}

async function within(promise, name) {
    let timer;
    try { return await Promise.race([promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${name} timed out`)), 5000); })]); }
    finally { clearTimeout(timer); }
}

test('revision replacement frees a legacy slot at a one-subscription per-caller limit', async () => {
    const server = new ArcServer({ query: { maxObservableSubscriptionsPerCaller: 1 },
        observableQueries: [defineObservableQuery({ name: 'Numbers', schema: z.object({}),
            observe: () => CurrentValueSubject.of([{ id: '1', name: 'first' }]) })] });
    const listening = await observableHost('express', server);
    const previous = { direct: Globals.queryDirectMode, method: Globals.queryTransportMethod,
        mode: Globals.observableQueryTransferMode };
    let subscription;
    try {
        resetSharedMultiplexer();
        Globals.queryDirectMode = false;
        Globals.queryTransportMethod = QueryTransportMethod.WebSocket;
        Globals.observableQueryTransferMode = 'full';
        const query = new Numbers(); query.setOrigin(listening.origin);
        const result = await within(new Promise(resolve => {
            subscription = query.subscribe(value => { if (value.data?.[0]?.name === 'first') resolve(value); });
        }), 'Revision replacement');
        assert.equal(result.isSuccess, true);
    } finally {
        subscription?.unsubscribe();
        resetSharedMultiplexer();
        Globals.queryDirectMode = previous.direct;
        Globals.queryTransportMethod = previous.method;
        Globals.observableQueryTransferMode = previous.mode;
        await server.dispose();
        await listening.close();
    }
});

for (const [direct, method] of [
    [false, QueryTransportMethod.WebSocket], [false, QueryTransportMethod.ServerSentEvents],
    [true, QueryTransportMethod.WebSocket], [true, QueryTransportMethod.ServerSentEvents]
]) test(`twelve installed-client subscriptions in ${direct ? 'direct' : 'hub'} ${method} mode`, async () => {
    const subject = CurrentValueSubject.of([{ id: '1', name: 'first' }]);
    let active = 0;
    const tracked = { current: () => subject.current(), subscribe(observer) {
        active++;
        const subscription = subject.subscribe(observer);
        return { unsubscribe() { active--; subscription.unsubscribe(); } };
    } };
    const server = new ArcServer({ authentication: [request => (request.headers.get('authorization') === 'Bearer alice' || request.headers.get('cookie')?.includes('arc-session=alice'))
        ? { status: AuthenticationStatus.Authenticated, principal: { id: 'alice', roles: [], isAuthenticated: true } }
        : { status: AuthenticationStatus.Anonymous }],
    observableQueries: [defineObservableQuery({ name: 'Numbers', schema: z.object({}), observe: () => tracked })] });
    const listening = await observableHost('express', server);
    const previous = { direct: Globals.queryDirectMode, method: Globals.queryTransportMethod,
        mode: Globals.observableQueryTransferMode, connections: Globals.queryConnectionCount,
        factory: Globals.eventSourceFactory, headers: Globals.httpHeadersCallback,
        eventSource: globalThis.EventSource, fetch: globalThis.fetch };
    const subscriptions = [];
    const pendingControls = [];
    try {
        resetSharedMultiplexer();
        Globals.queryDirectMode = direct;
        Globals.queryTransportMethod = method;
        Globals.observableQueryTransferMode = 'full';
        Globals.queryConnectionCount = 1;
        if (method === QueryTransportMethod.ServerSentEvents) {
            globalThis.EventSource = FetchEventSource;
            Globals.eventSourceFactory = url => new FetchEventSource(url, { cookie: 'arc-session=alice' });
            Globals.httpHeadersCallback = () => ({ Cookie: 'arc-session=alice' });
            globalThis.fetch = (url, init) => {
                const response = previous.fetch(url, init);
                if (String(url).endsWith('/sse/unsubscribe')) pendingControls.push(response);
                return response;
            };
        }
        const results = Array.from({ length: 12 }, () => new Promise(resolve => {
            const query = new Numbers();
            query.setOrigin(listening.origin);
            subscriptions.push(query.subscribe(result => {
                if (result.data?.[0]?.name === 'first') resolve(result);
            }));
        }));
        const received = await within(Promise.all(results), 'Twelve subscriptions');
        assert.equal(received.length, 12);
        assert.equal(active, 12);
    } finally {
        for (const subscription of subscriptions) subscription.unsubscribe();
        await within(Promise.allSettled(pendingControls), 'SSE unsubscribe controls');
        resetSharedMultiplexer();
        Globals.queryDirectMode = previous.direct;
        Globals.queryTransportMethod = previous.method;
        Globals.observableQueryTransferMode = previous.mode;
        Globals.queryConnectionCount = previous.connections;
        Globals.eventSourceFactory = previous.factory;
        Globals.httpHeadersCallback = previous.headers;
        globalThis.fetch = previous.fetch;
        if (previous.eventSource === undefined) delete globalThis.EventSource;
        else globalThis.EventSource = previous.eventSource;
        await server.dispose();
        assert.equal(active, 0);
        await listening.close();
    }
});

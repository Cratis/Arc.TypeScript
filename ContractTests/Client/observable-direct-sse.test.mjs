// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { clientTest as test, scratch } from './scratch.mjs';
import { observableHost } from './observableHost.mjs';
import { FetchEventSource } from './FetchEventSource.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { Globals } from '@cratis/arc';
import { QueryTransportMethod } from '@cratis/arc/queries';
import { ArcServer, CurrentValueSubject, defineObservableQuery, exportClientManifest } from '@cratis/arc.server';
import { generateClient } from '@cratis/arc.server.codegen';
async function within(promise, label) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out`)), 3000); })
        ]);
    } finally { clearTimeout(timer); }
}

for (const kind of ['express', 'fastify', 'hono']) test(`generated installed client receives direct SSE from live ${kind}`, async () => {
    const subject = new CurrentValueSubject({ hasValue: true, value: [{ id: '1', name: 'first' }] });
    let active = 0;
    let released;
    const tracked = {
        current: () => subject.current(),
        subscribe(observer) {
            active++;
            const subscription = subject.subscribe(observer);
            return { unsubscribe() { active--; released?.(); subscription.unsubscribe(); } };
        }
    };
    const pending = new CurrentValueSubject();
    let privateObserved = 0;
    const clientOutput = { output: { kind: 'array', element: { kind: 'dto', name: 'NumberItem', fields: [
        { name: 'id', type: { kind: 'string' } }, { name: 'name', type: { kind: 'string' } }
    ] } } };
    const server = new ArcServer({ observableQueries: [
        defineObservableQuery({ name: 'Numbers', schema: z.object({}), observe: () => tracked, clientOutput }),
        defineObservableQuery({ name: 'Pending', schema: z.object({}), observe: () => pending, clientOutput }),
        defineObservableQuery({ name: 'Private', schema: z.object({}), authorization: { authenticated: true },
            observe: () => { privateObserved++; return tracked; }, clientOutput })
    ] });
    const manifest = exportClientManifest(server);
    assert.equal(manifest.operations[0].kind, 'observable');
    const directory = await scratch();
    const output = join(directory, 'src');
    await mkdir(output);
    await generateClient(manifest, output);
    const proxy = await readFile(join(output, 'Numbers.proxy.ts'), 'utf8');
    assert.match(proxy, /extends ObservableQueryFor<NumberItem\[\], NumbersParameters>/);
    assert.match(proxy, /readonly queryName = "Numbers"/);
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
            verbatimModuleSyntax: true, skipLibCheck: false, noEmitOnError: true, outDir: './dist', rootDir: './src', types: ['node'] },
        include: ['src/*.ts']
    }));
    execFileSync(resolve(import.meta.dirname, '../../node_modules/.bin/tsc'), ['-p', join(directory, 'tsconfig.json')]);
    const { Numbers } = await import(pathToFileURL(join(directory, 'dist/Numbers.proxy.js')));
    const { Private } = await import(pathToFileURL(join(directory, 'dist/Private.proxy.js')));
    const listening = await observableHost(kind, server);
    const previous = { direct: Globals.queryDirectMode, method: Globals.queryTransportMethod, factory: Globals.eventSourceFactory };
    try {
        Globals.queryDirectMode = true;
        Globals.queryTransportMethod = QueryTransportMethod.ServerSentEvents;
        Globals.eventSourceFactory = url => new FetchEventSource(url);
        const query = new Numbers();
        query.setOrigin(listening.origin);
        const snapshot = await query.perform();
        assert.equal(snapshot.isSuccess, true);
        assert.equal(snapshot.data[0].name, 'first');
        let firstReceived;
        const first = new Promise(resolve => { firstReceived = resolve; });
        let nextReceived;
        const next = new Promise(resolve => { nextReceived = resolve; });
        const release = new Promise(resolve => { released = resolve; });
        const subscription = query.subscribe(value => {
            if (value.data?.[0]?.name === 'first') firstReceived(value);
            if (value.data?.[0]?.name === 'second') nextReceived(value);
        });
        assert.equal((await within(first, 'Direct SSE initial')).isAuthorized, true);
        subject.next([{ id: '1', name: 'second' }]);
        assert.equal((await within(next, 'Direct SSE update')).data[0].name, 'second');
        subscription.unsubscribe();
        await within(release, 'Direct SSE release');
        assert.equal(active, 0);
        subject.next([{ id: '1', name: 'first' }]);
        const notReady = await fetch(`${listening.origin}/api/pending`);
        assert.equal(notReady.status, 202);
        assert.equal((await notReady.json()).isReady, false);
        const timedOut = await fetch(`${listening.origin}/api/pending?waitForFirstResult=true&waitForFirstResultTimeout=0.01`);
        assert.equal(timedOut.status, 408);
        assert.equal((await timedOut.json()).hasExceptions, true);
        Globals.queryTransportMethod = QueryTransportMethod.WebSocket;
        const live = new Numbers();
        live.setOrigin(listening.origin);
        let wsInitial;
        let wsUpdated;
        const initial = new Promise(resolve => { wsInitial = resolve; });
        const update = new Promise(resolve => { wsUpdated = resolve; });
        const wsRelease = new Promise(resolve => { released = resolve; });
        const liveSubscription = live.subscribe(value => {
            if (value.data?.[0]?.name === 'first') wsInitial(value);
            if (value.data?.[0]?.name === 'second') wsUpdated(value);
        });
        assert.equal((await within(initial, 'Direct WS initial')).data[0].name, 'first');
        subject.next([{ id: '1', name: 'second' }]);
        assert.equal((await within(update, 'Direct WS update')).data[0].name, 'second');
        liveSubscription.unsubscribe();
        await within(wsRelease, 'Direct WS release');
        assert.equal(active, 0);
        subject.next([{ id: '1', name: 'first' }]);
        const denied = new Private();
        denied.setOrigin(listening.origin);
        const unauthorized = await within(new Promise(resolve => denied.subscribe(resolve)), 'Direct WS denial');
        assert.equal(unauthorized.isAuthorized, false);
        assert.equal(privateObserved, 0);
        const socket = new WebSocket(`${listening.origin.replace('http:', 'ws:')}/api/numbers`);
        await within(new Promise(resolve => socket.addEventListener('open', resolve, { once: true })), 'Raw WebSocket');
        const pong = new Promise(resolve => socket.addEventListener('message', event => {
            const message = JSON.parse(event.data);
            if (message.type === 'Pong') resolve(message);
        }));
        socket.send(JSON.stringify({ type: 'Ping', timestamp: 123 }));
        assert.equal((await within(pong, 'WebSocket pong')).timestamp, 123);
        const rawRelease = new Promise(resolve => { released = resolve; });
        socket.close();
        await within(rawRelease, 'Raw WS release');
        assert.equal(active, 0);
        const abandoned = new WebSocket(`${listening.origin.replace('http:', 'ws:')}/api/numbers`);
        await within(new Promise(resolve => abandoned.addEventListener('open', resolve, { once: true })), 'Shutdown WS open');
        await within(new Promise(resolve => abandoned.addEventListener('message', resolve, { once: true })), 'Shutdown WS data');
        const shutdownRelease = new Promise(resolve => { released = resolve; });
        await server.dispose();
        await within(shutdownRelease, 'Shutdown source release');
        assert.equal(active, 0);
    } finally {
        Globals.queryDirectMode = previous.direct;
        Globals.queryTransportMethod = previous.method;
        Globals.eventSourceFactory = previous.factory;
        await server.dispose();
        await listening.close();
    }
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { setInterval, clearInterval } from 'node:timers';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import Fastify from 'fastify';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cratisArc as expressArc } from '@cratis/arc.express';
import { cratisArc as fastifyArc } from '@cratis/arc.fastify';
import { cratisArc as honoArc } from '@cratis/arc.hono';
import { ArcApplication, serviceToken } from '@cratis/arc.core';
import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';
import { firstValueFrom, filter, timeout } from 'rxjs';
import { ChronicleReadModels } from '../dist/ChronicleReadModels.js';
import { ChronicleArtifacts } from '../dist/ChronicleArtifacts.js';
import { reactorCommandResultHandler } from '../dist/reactorCommands.js';
import '../dist/index.js';
import * as live from '../dist/Integration/LiveArtifacts.js';
const { CreateLive, CreateLiveExactlyOnce, CreateLiveBatch, CreateLiveWithOperation, AdvanceLive,
    ReadLiveInCommand, AdvanceLiveWithConcurrentAppend, LiveCreated, LiveFollowedUp, FollowUpLive, LiveCommandReactor, LiveView } = live;

// Keep the test runner alive while an SDK reactor observation waits on an unreferenced gRPC stream.
const observationKeepAlive = setInterval(() => {}, 1000);
const connectionString = process.env.ARC_CHRONICLE_TEST_URL;
if (!connectionString) throw new Error('ARC_CHRONICLE_TEST_URL is required; do not silently skip the kernel suite');
const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
trace.setGlobalTracerProvider(provider);
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
const artifacts = new ChronicleArtifacts();
for (const type of [CreateLive, CreateLiveExactlyOnce, CreateLiveBatch, CreateLiveWithOperation, AdvanceLive,
    AdvanceLiveWithConcurrentAppend, ReadLiveInCommand, LiveCreated, LiveFollowedUp, FollowUpLive, LiveCommandReactor, LiveView]) artifacts.register(type);
let application;
const storeName = `ArcTsLive${randomUUID().replaceAll('-', '')}`;
const client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString, {
    clientArtifactsProvider: artifacts, discoveryPatterns: [], reactorResultHandler: reactorCommandResultHandler(() => application.server, storeName)
}));
const interceptor = serviceToken('live read model interceptor');
const builder = ArcApplication.createBuilder({ development: true,
    readModelInterceptors: [interceptor],
    resolveTenant: request => request.headers.get('x-test-tenant') ?? undefined });
builder.services.addScoped(interceptor, () => ({ model: LiveView, intercept: view => {
    const publicView = new LiveView();
    Object.assign(publicView, view);
    publicView.name = `public-${view.name}`;
    return publicView;
} }));
builder.withChronicle({ client, eventStore: storeName });
builder.add(CreateLive, CreateLiveExactlyOnce, CreateLiveBatch, CreateLiveWithOperation, AdvanceLive,
    AdvanceLiveWithConcurrentAppend, ReadLiveInCommand, LiveCreated, LiveFollowedUp, FollowUpLive, LiveCommandReactor, LiveView);
application = await builder.build();

async function host(kind) {
    if (kind === 'express') {
        const app = express(); app.use(expressArc(application));
        const server = createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
        return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve, reject) =>
            server.close(error => error ? reject(error) : resolve())) };
    }
    if (kind === 'fastify') {
        const app = Fastify(); app.register(fastifyArc, { arc: application });
        const url = await app.listen({ host: '127.0.0.1', port: 0 });
        return { url, close: () => app.close() };
    }
    const app = new Hono(); app.use(honoArc(application));
    const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
    await once(server, 'listening');
    return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve, reject) =>
        server.close(error => error ? reject(error) : resolve())) };
}
async function call(url, command, id, tenant, name) {
    const response = await globalThis.fetch(`${url}/api/${command}`, { method: 'POST', headers: {
        'content-type': 'application/json', 'x-test-tenant': tenant
    }, body: JSON.stringify({ id, name }) });
    return { status: response.status, body: await response.json() };
}
try {
    const checks = [];
    for (const adapter of ['express', 'fastify', 'hono']) {
        checks.push(test(`Chronicle command via ${adapter}`, async () => {
            const listener = await host(adapter);
            try {
                const id = randomUUID();
                const tenant = `Tenant${adapter}`;
                const first = await call(listener.url, 'create-live', id, tenant, adapter);
                assert.equal(first.body.isSuccess, true, JSON.stringify(first));
                const store = await client.getEventStore(storeName, tenant);
                const events = await store.eventLog.getForEventSourceIdAndEventTypes(id, [LiveCreated]);
                assert.equal(events.length, 1, 'append is visible in tenant namespace');
                let followups = [];
                for (let attempt = 0; attempt < 40 && followups.length === 0; attempt++) {
                    followups = await store.eventLog.getForEventSourceIdAndEventTypes(id, [LiveFollowedUp]);
                    if (!followups.length) await delay(250);
                }
                assert.equal(followups.length, 1, 'reactor command executes in the event tenant and appends its follow-up');
                assert.equal(followups[0].content.name, adapter);
                const commandSpan = exporter.getFinishedSpans().find(span =>
                    span.name === 'cratis.arc.command.execute' &&
                    span.attributes['cratis.correlation_id'] === first.body.correlationId);
                assert.ok(commandSpan, 'the committed Chronicle append completes inside the Arc command span');
                const other = await client.getEventStore(storeName, `${tenant}Other`);
                assert.equal((await other.eventLog.getForEventSourceIdAndEventTypes(id, [LiveCreated])).length, 0);
                const conflict = await call(listener.url, 'create-live-exactly-once', id, tenant, adapter);
                assert.equal(conflict.body.isSuccess, false, 'exact before-first scope rejects an existing stream');
                assert.equal(conflict.body.validationResults?.[0]?.reason, 'concurrencyViolation', JSON.stringify(conflict));
                assert.equal((await store.eventLog.getForEventSourceIdAndEventTypes(id, [LiveCreated])).length, 1);
                let materialized = [];
                for (let attempt = 0; attempt < 30 && !materialized.some(item => item.id === id); attempt++) {
                    materialized = await store.readModels.getInstances(LiveView);
                    if (!materialized.some(item => item.id === id)) await delay(250);
                }
                assert.ok(materialized.some(item => item.id === id), 'projection materialized the read model');
                const model = await store.readModels.findInstanceById(LiveView, id);
                assert.ok(model, 'by-id lookup resolves the projected read model');
                assert.equal(model.name, adapter);
                const query = await globalThis.fetch(`${listener.url}/api/by-id?id=${id}`, { headers: { 'x-test-tenant': tenant } });
                const result = await query.json();
                assert.equal(result.data.name, `public-${adapter}`, 'Chronicle model is intercepted before wire encoding');
                assert.equal((await store.readModels.findInstanceById(LiveView, id)).name, adapter,
                    'interception does not change the persisted read model');
                const watchedId = randomUUID();
                const models = new ChronicleReadModels({ getStore: async () => store }, { tenantId: tenant });
                const watched = firstValueFrom(models.watch(LiveView).pipe(
                    filter(change => change.key === watchedId), timeout({ first: 10000 })));
                await delay(250);
                const watchedCommand = await call(listener.url, 'create-live', watchedId, tenant, `watched-${adapter}`);
                assert.equal(watchedCommand.body.isSuccess, true, JSON.stringify(watchedCommand));
                assert.equal((await watched).readModel.name, `watched-${adapter}`,
                    'Chronicle read-model changes flow through the RxJS observable');
                const resolved = await call(listener.url, 'read-live-in-command', id, tenant, adapter);
                assert.equal(resolved.body.isSuccess, true, JSON.stringify(resolved));
                assert.equal(resolved.body.response, adapter);
                const missing = await call(listener.url, 'read-live-in-command', randomUUID(), tenant, adapter);
                assert.equal(missing.body.isSuccess, false, JSON.stringify(missing));
                assert.equal(missing.body.validationResults?.[0]?.reason, 'rule', JSON.stringify(missing));
                const batchId = randomUUID();
                const batch = await call(listener.url, 'create-live-batch', batchId, tenant, adapter);
                assert.equal(batch.body.isSuccess, true, JSON.stringify(batch));
                assert.equal((await store.eventLog.getForEventSourceIdAndEventTypes(batchId, [LiveCreated])).length, 2);
                const advance = await call(listener.url, 'advance-live', id, tenant, `advanced-${adapter}`);
                assert.equal(advance.body.isSuccess, true, JSON.stringify(advance));
                assert.equal((await store.eventLog.getForEventSourceIdAndEventTypes(id, [LiveCreated])).length, 2,
                    'aggregate replays existing state and commits despite an interleaved reactor event');
                const staleId = randomUUID();
                const createdForConflict = await call(listener.url, 'create-live', staleId, tenant, adapter);
                assert.equal(createdForConflict.body.isSuccess, true, JSON.stringify(createdForConflict));
                const stale = await call(listener.url, 'advance-live-with-concurrent-append', staleId, tenant, adapter);
                assert.equal(stale.body.isSuccess, false, JSON.stringify(stale));
                assert.equal(stale.body.validationResults?.[0]?.reason, 'concurrencyViolation', JSON.stringify(stale));
                assert.equal((await store.eventLog.getForEventSourceIdAndEventTypes(staleId, [LiveCreated])).length, 2,
                    'only the competing append is recorded');
                const deniedOperation = await call(listener.url, 'create-live-with-operation', id, tenant, adapter);
                assert.equal(deniedOperation.body.isSuccess, false, JSON.stringify(deniedOperation));
                assert.equal(live.liveOperationExecuted, true);
                assert.equal(live.liveOperationCompensated, true, 'rejected append compensates the operation');
                assert.equal((await store.eventLog.getForEventSourceIdAndEventTypes(id, [LiveCreated])).length, 2,
                    'rejected operation batch adds no events');
            } finally { await listener.close(); }
        }));
    }
    await Promise.all(checks);
} finally {
    await application.dispose();
    client.dispose();
    await provider.shutdown();
    trace.disable();
    context.disable();
    clearInterval(observationKeepAlive);

}

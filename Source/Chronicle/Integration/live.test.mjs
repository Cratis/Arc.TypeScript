// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import Fastify from 'fastify';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { mountExpress } from '@cratis/arc.express';
import { mountFastify } from '@cratis/arc.fastify';
import { mountHono } from '@cratis/arc.hono';
import { ArcApplication } from '@cratis/arc.core';
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';
import { ChronicleArtifacts } from '../dist/ChronicleArtifacts.js';
import '../dist/index.js';
import { CreateLive, CreateLiveExactlyOnce, CreateLiveBatch, ReadLiveInCommand, LiveCreated, LiveView } from '../dist/Integration/LiveArtifacts.js';

const connectionString = process.env.ARC_CHRONICLE_TEST_URL;
if (!connectionString) throw new Error('ARC_CHRONICLE_TEST_URL is required; do not silently skip the kernel suite');
const artifacts = new ChronicleArtifacts();
for (const type of [CreateLive, CreateLiveExactlyOnce, CreateLiveBatch, ReadLiveInCommand, LiveCreated, LiveView]) artifacts.register(type);
const client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString, {
    clientArtifactsProvider: artifacts, discoveryPatterns: []
}));
const storeName = `ArcTsLive${randomUUID().replaceAll('-', '')}`;
const builder = ArcApplication.createBuilder({ development: true,
    resolveTenant: request => request.headers.get('x-test-tenant') ?? undefined });
builder.addChronicle({ client, eventStore: storeName });
builder.add(CreateLive, CreateLiveExactlyOnce, CreateLiveBatch, ReadLiveInCommand, LiveCreated, LiveView);
const application = await builder.build();

async function host(kind) {
    if (kind === 'express') {
        const app = express(); mountExpress(app, application);
        const server = createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
        return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve, reject) =>
            server.close(error => error ? reject(error) : resolve())) };
    }
    if (kind === 'fastify') {
        const app = Fastify(); mountFastify(app, application);
        const url = await app.listen({ host: '127.0.0.1', port: 0 });
        return { url, close: () => app.close() };
    }
    const app = new Hono(); mountHono(app, application);
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
    for (const adapter of ['express', 'fastify', 'hono']) {
        await test(`Chronicle command via ${adapter}`, async () => {
            const listener = await host(adapter);
            try {
                const id = randomUUID();
                const tenant = `Tenant${adapter}`;
                const first = await call(listener.url, 'create-live', id, tenant, adapter);
                assert.equal(first.body.isSuccess, true, JSON.stringify(first));
                const store = await client.getEventStore(storeName, tenant);
                const events = await store.eventLog.getForEventSourceIdAndEventTypes(id, [LiveCreated]);
                assert.equal(events.length, 1, 'append is visible in tenant namespace');
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
                assert.equal(result.data.name, adapter, JSON.stringify(result));
                const resolved = await call(listener.url, 'read-live-in-command', id, tenant, adapter);
                assert.equal(resolved.body.isSuccess, true, JSON.stringify(resolved));
                assert.equal(resolved.body.response, adapter);
                const batchId = randomUUID();
                const batch = await call(listener.url, 'create-live-batch', batchId, tenant, adapter);
                assert.equal(batch.body.isSuccess, true, JSON.stringify(batch));
                assert.equal((await store.eventLog.getForEventSourceIdAndEventTypes(batchId, [LiveCreated])).length, 2);
            } finally { await listener.close(); }
        });
    }
} finally {
    await application.dispose();
    client.dispose();
}

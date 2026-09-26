// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { createRequire } from 'node:module';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { SpanKind } from '@opentelemetry/api';
import pino from 'pino';

const exporter = new InMemorySpanExporter();
const sdk = new NodeSDK({ spanProcessors: [new SimpleSpanProcessor(exporter)],
    metricReaders: [], logRecordProcessors: [],
    instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation(), new FastifyInstrumentation()] });
sdk.start(); // Start before loading HTTP or host modules.

const require = createRequire(import.meta.url);
const { createServer } = require('node:http');
const { once } = await import('node:events');
// Framework instrumentation patches CommonJS require; ESM imports alone do not activate it.
const express = require('express');
const Fastify = require('fastify');
const { Hono } = await import('hono');
const { serve } = await import('@hono/node-server');
const { ArcServer, defineCommand } = await import('@cratis/arc.core');
const { cratisArc: expressArc } = await import('@cratis/arc.express');
const { cratisArc: fastifyArc } = await import('@cratis/arc.fastify');
const { cratisArc: honoArc } = await import('@cratis/arc.hono');
const { z } = await import('zod');

function arcServer() {
    return new ArcServer({ commands: [defineCommand({ name: 'Echo', schema: z.object({ value: z.string() }),
        handle: ({ value }) => value })] });
}
async function listen(server) {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return `http://127.0.0.1:${server.address().port}`;
}
async function close(server) {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
async function verify(name, start) {
    exporter.reset();
    const arc = arcServer();
    let host;
    try {
        host = await start(arc);
        const response = await fetch(host.url + '/api/echo', { method: 'POST',
            headers: { 'content-type': 'application/json' }, body: '{"value":"ok"}' });
        assert.equal(response.status, 200, `${name} HTTP response`);
        assert.equal((await response.json()).response, 'ok');
        const spans = exporter.getFinishedSpans();
        const serverSpans = spans.filter(span => span.kind === SpanKind.SERVER &&
            (span.attributes['http.method'] ?? span.attributes['http.request.method']) === 'POST' &&
            (span.attributes['http.target'] ?? span.attributes['url.path']) === '/api/echo');
        assert.equal(serverSpans.length, 1, `${name} must produce exactly one HTTP server span`);
        const arcSpans = spans.filter(span => span.name === 'cratis.arc.http.handle');
        assert.equal(arcSpans.length, 1, `${name} must produce one Arc HTTP span`);
        assert.equal(arcSpans[0].kind, SpanKind.INTERNAL);
        const serverSpan = serverSpans[0];
        const traceId = serverSpan.spanContext().traceId;
        const byId = new Map(spans.filter(span => span.spanContext().traceId === traceId)
            .map(span => [span.spanContext().spanId, span]));
        const ancestors = new Set();
        let parentId = arcSpans[0].parentSpanContext?.spanId;
        while (parentId && parentId !== serverSpan.spanContext().spanId) {
            assert.ok(!ancestors.has(parentId), `${name} span ancestry has a cycle`);
            ancestors.add(parentId);
            const parent = byId.get(parentId);
            assert.ok(parent, `${name} Arc HTTP span has a missing ancestor`);
            parentId = parent.parentSpanContext?.spanId;
        }
        assert.equal(arcSpans[0].spanContext().traceId, traceId);
        assert.equal(parentId, serverSpan.spanContext().spanId,
            `${name} Arc HTTP span must descend from the HTTP server span`);
        if (name !== 'Hono') {
            assert.ok([...ancestors].some(id => byId.get(id)?.instrumentationScope.name ===
                `@opentelemetry/instrumentation-${name.toLowerCase()}`),
            `${name} framework instrumentation must be in the Arc span ancestry`);
        }
        console.log(`${name}: Arc INTERNAL span descends from HTTP SERVER span${name === 'Hono' ? '' : ' through framework instrumentation'}`);
    } finally { if (host) await host.close(); await arc.dispose(); }
}

try {
    await verify('Express', async arc => {
        const app = express();
        app.use(expressArc(arc));
        const server = createServer(app);
        return { url: await listen(server), close: () => close(server) };
    });
    await verify('Fastify', async arc => {
        const app = Fastify();
        await app.register(fastifyArc, { arc });
        await app.listen({ port: 0, host: '127.0.0.1' });
        return { url: `http://127.0.0.1:${app.server.address().port}`, close: () => app.close() };
    });
    await verify('Hono', async arc => {
        const app = new Hono();
        app.use(honoArc(arc));
        const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
        await once(server, 'listening');
        return { url: `http://127.0.0.1:${server.address().port}`, close: () => close(server) };
    });
} finally { await sdk.shutdown(); }

// Pino belongs to the application, not to Arc or its HTTP error envelope.
const records = [];
const logger = pino({ level: 'error' }, { write: line => records.push(JSON.parse(line)) });
const secret = 'secret-command-payload';
const correlationId = '11111111-1111-4111-8111-111111111111';
const arc = new ArcServer({ exposeExceptionDetails: false,
    commands: [defineCommand({ name: 'Fail', schema: z.object({ value: z.string() }),
        handle: () => { throw Error('private handler failure'); } })],
    logger: (error, id) => logger.error({ err: error, correlationId: id }, 'Arc request failed') });
try {
    const response = await arc.handle(new Request('http://arc.invalid/api/fail', { method: 'POST',
        headers: { 'content-type': 'application/json', 'x-correlation-id': correlationId },
        body: JSON.stringify({ value: secret }) }));
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('x-correlation-id'), correlationId);
    const body = await response.text();
    assert.doesNotMatch(body, /private handler failure|secret-command-payload/);
    assert.equal(records.length, 1);
    assert.equal(records[0].correlationId, correlationId);
    assert.equal(records[0].err.message, 'private handler failure');
    assert.deepEqual(Object.keys(records[0]).sort(), ['correlationId', 'err', 'level', 'msg', 'pid', 'hostname', 'time'].sort());
    assert.doesNotMatch(JSON.stringify(records), /secret-command-payload/);
    console.log('pino: correlation logged; payload omitted; HTTP error redacted');
} finally { await arc.dispose(); }

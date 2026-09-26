---
title: Observe Arc requests
description: Subscribe to Arc for TypeScript tracing and operation durations with an application-owned OpenTelemetry SDK.
---

A slow command in production is hard to explain from logs alone. Was the time spent in validation, in your handler, or in the HTTP layer? Arc for TypeScript emits spans for its pipeline stages and an operation-duration histogram through `@opentelemetry/api`, so the tracing backend you already run can answer that.

Core does not install an exporter, context manager, or SDK, so it stays usable without any tracing infrastructure. You install and start an SDK **in your application**, before you build the Arc server. Arc never sends raw exception messages to spans, including in development.

## Before you start

- `@opentelemetry/api`, the required peer dependency of `@cratis/arc.core`. No exporter is required.
- For the example below, a clone of this repository after `yarn install && yarn build`. The workspace provides the SDK development dependencies.
- In your own application, install `@opentelemetry/sdk-node`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/sdk-metrics`, and `zod` there instead of depending on the SDK from core. [Create an application](getting-started/create-an-application.md) shows how to install the unpublished Arc packages.

## Start a local console exporter

Save the following as `observability-example.mjs` at the repository root and run `node observability-example.mjs` with Node.js 22.19 or later:

```js
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { ConsoleMetricExporter, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

const sdk = new NodeSDK({
    traceExporter: new ConsoleSpanExporter(),
    metricReaders: [new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(), exportIntervalMillis: 1000
    })]
});
sdk.start();

const { ArcServer, defineQuery } = await import('@cratis/arc.core');
const { z } = await import('zod');
const server = new ArcServer({ queries: [defineQuery({
    name: 'Ping', schema: z.object({}), perform: () => [{ id: 1 }]
})] });
try {
    const response = await server.handle(new Request('http://localhost/api/ping'));
    console.log(await response?.json());
} finally {
    await server.dispose();
    await sdk.shutdown();
}
```

You see the query result, then spans and a `cratis.arc.operation.duration` histogram from the `Cratis.Arc` source and meter. In a real host, replace the console exporters with exporters configured for your collector.

If the SDK starts after Arc is imported, Arc uses the API's proxy tracer. Initialize the SDK before sending requests so nothing is missed.

## Connect host HTTP spans to Arc

If you need a request trace across host middleware and Arc, start your SDK **before importing** the HTTP server or adapter. The host owns W3C `traceparent` extraction and propagation; Arc emits child spans under the active context. The following runnable Express host uses an in-memory exporter for inspection (use your own exporter in production). Install `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/sdk-node`, `@opentelemetry/sdk-trace-base`, `express`, and `zod` in the host application.

```typescript title="observability-host.ts"
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { SpanKind } from '@opentelemetry/api';

const exporter = new InMemorySpanExporter();
const instrumentations = getNodeAutoInstrumentations().filter(item =>
    ['@opentelemetry/instrumentation-http', '@opentelemetry/instrumentation-express'].includes(item.instrumentationName));
const sdk = new NodeSDK({ spanProcessors: [new SimpleSpanProcessor(exporter)], instrumentations });
sdk.start();

const { createServer } = await import('node:http');
const { default: express } = await import('express');
const { ArcServer, defineCommand } = await import('@cratis/arc.core');
const { cratisArc } = await import('@cratis/arc.express');
const { z } = await import('zod');
const arc = new ArcServer({ commands: [defineCommand({ name: 'Echo', schema: z.object({ value: z.string() }),
    handle: ({ value }) => value })] });
const host = express();
host.use(cratisArc(arc));
const server = createServer(host);
try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('No listening port');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/echo`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"value":"ok"}'
    });
    if (response.status !== 200) throw Error(`HTTP ${response.status}`);
    await response.text();
    const spans = exporter.getFinishedSpans();
    const http = spans.find(span => span.kind === SpanKind.SERVER);
    const arcHttp = spans.find(span => span.name === 'cratis.arc.http.handle');
    if (!http || arcHttp?.parentSpanContext?.spanId !== http.spanContext().spanId) throw Error('Missing parent span');
    console.log(http.name, '→', arcHttp.name);
} finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await arc.dispose();
    await sdk.shutdown();
}
```

The host's Node HTTP span surrounds Arc's INTERNAL `cratis.arc.http.handle` span; it is not a second Arc SERVER span. `yarn check:observability-recipes` exercises **real HTTP** with Express (HTTP and Express instrumentation), Fastify (HTTP and Fastify instrumentation), and Hono on its Node server (HTTP instrumentation; no Hono-specific instrumentation installed). For each host it asserts exactly one HTTP SERVER span parents the Arc span for a command. It also checks the structured-logging recipe below. In-memory export proves local parenting, not remote collector delivery or trace-context propagation through a proxy.

## Log errors without exposing payloads

Arc's `logger(error, correlationId)` callback runs on the server side. Pino can serialize the error under `err` without logging a command or request body. Install `pino` in the host application; do not send this logger's output to the client.

```typescript title="logging.ts"
import pino from 'pino';
import { ArcServer, defineCommand } from '@cratis/arc.core';
import { z } from 'zod';

const log = pino();
const arc = new ArcServer({ exposeExceptionDetails: false,
    commands: [defineCommand({ name: 'Fail', schema: z.object({ value: z.string() }),
        handle: () => { throw Error('private handler failure'); } })],
    logger: (error, correlationId) => log.error({ err: error, correlationId }, 'Arc request failed')
});
try {
    const response = await arc.handle(new Request('http://localhost/api/fail', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: '{"value":"secret"}' }));
    console.log(response?.status, await response?.text());
} finally { await arc.dispose(); }
```

The HTTP response is redacted outside development (explicitly set here). `yarn check:observability-recipes` asserts that a failing command logs its correlation ID and error, that the HTTP response does not reveal the error, and that the structured log does not contain the command payload. Control log access and retention according to your application's secrets policy; the serialized `err` can contain sensitive exception details.

## Span names

| Span | Boundary | Attributes |
| --- | --- | --- |
| `cratis.arc.command.execute` | Command execution | `command_type`, `cratis.correlation_id` |
| `cratis.arc.command.validate` | Validate-only pipeline | `command_type`, `cratis.correlation_id` |
| `cratis.arc.command.filter` | Command validation/filter stage | `command_type`, `cratis.correlation_id` |
| `cratis.arc.query.perform` | Snapshot query or observable source open | `query_name`, `cratis.correlation_id` |
| `cratis.arc.query.filter` | Query validation/filter stage | `query_name`, `cratis.correlation_id` |
| `cratis.arc.http.handle` | Recognized Arc HTTP endpoint (INTERNAL) | `http.request.method`, `http.route`, `cratis.correlation_id` |
| `cratis.arc.query.emission` | Observable current value or subsequent delivery | `query_name`, `cratis.correlation_id` |
| `cratis.arc.query.subscribe` | Parent scope lifetime, including observable snapshots | `query_name`, `cratis.correlation_id` |
| `cratis.arc.identity.resolve` | Identity details provider resolution | `cratis.correlation_id` |

`command_type` and `query_name` are the registered qualified names, not payloads.

The first five span names and the identity-resolution span use the .NET pipeline names. The HTTP, emission, and subscription spans are Node-specific: .NET uses ASP.NET request instrumentation and does not have a per-emission span.

## Metrics

| Instrument | Unit | What it measures |
| --- | --- | --- |
| `cratis.arc.operation.duration` | Seconds | Each operation, tagged with `operation` and the applicable type, name, or route |
| `cratis.arc.subscription.duration` | Seconds | How long each observable subscription stayed open |

Both are recorded under the `Cratis.Arc` meter. .NET's core pipeline exposes a meter but does not record command or query durations.

## What Arc does not instrument

- **Foreign routes.** Routes your host serves outside Arc get no Arc spans. Use your host's HTTP instrumentation for those.
- **W3C trace context.** A valid configured [correlation header](reference/capabilities.md#security-identity-tenancy-and-correlation) is reflected in `cratis.correlation_id` and in the response. It is not a W3C trace-context propagator; configure your host instrumentation for `traceparent`.

The Kotlin/JVM adapter uses Micrometer observations; it is not an OpenTelemetry SDK dependency of the TypeScript core.

## Next steps

- [Configuration](configuration/index.md) sets the correlation header name with `correlationId.httpHeader`.
- [Diagnostics](reference/diagnostics.md) lists the other signals Arc produces when something goes wrong.

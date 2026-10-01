---
title: Observe Arc requests
description: Subscribe to Arc for TypeScript tracing and command and query duration histograms with an application-owned OpenTelemetry SDK.
---

A slow command in production is hard to explain from logs alone. Was the time spent in validation, in your handler, or in the HTTP layer? Arc for TypeScript emits spans for its pipeline stages and command and query duration histograms through `@opentelemetry/api`, so the tracing backend you already run can answer that.

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
    })],
    logRecordProcessors: []
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

You see the query result, then spans and a `cratis.arc.query.duration` histogram from the `Cratis.Arc` tracer and meter. Both scopes carry the installed `@cratis/arc.core` package version. In a real host, replace the console exporters with exporters configured for your collector.

If the SDK starts after Arc is imported, Arc uses the API's proxy tracer. Initialize the SDK before sending requests so nothing is missed.

## Connect host HTTP spans to Arc

If you need a request trace across host middleware and Arc, start your SDK **before loading** the HTTP server or adapter. The host owns W3C `traceparent` extraction and propagation; Arc emits child spans under the active context. The following Express host uses an in-memory span exporter for inspection (use your own exporter in production). It enables only HTTP and Express instrumentation, and disables metric and log exporting. Express is loaded with CommonJS `require` after SDK startup because the Express instrumentation does not hook ESM imports without an OpenTelemetry loader hook. A pure ESM host registers that hook instead (`node --import` with a module that calls `register('@opentelemetry/instrumentation/hook.mjs', import.meta.url)` before the SDK starts); that path is not covered by the check below. Install `@opentelemetry/instrumentation-http`, `@opentelemetry/instrumentation-express`, `@opentelemetry/sdk-node`, `@opentelemetry/sdk-trace-base`, `express`, and `zod` in the host application.

```typescript title="observability-host.ts"
import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { createRequire } from 'node:module';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { SpanKind } from '@opentelemetry/api';

const exporter = new InMemorySpanExporter();
const sdk = new NodeSDK({ spanProcessors: [new SimpleSpanProcessor(exporter)],
    metricReaders: [], logRecordProcessors: [],
    instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()] });
sdk.start();

const require = createRequire(import.meta.url);
const { createServer } = require('node:http') as typeof import('node:http');
const express = require('express') as typeof import('express');
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
    const servers = spans.filter(span => span.kind === SpanKind.SERVER &&
        (span.attributes['http.method'] ?? span.attributes['http.request.method']) === 'POST' &&
        (span.attributes['http.target'] ?? span.attributes['url.path']) === '/api/echo');
    const arcSpans = spans.filter(span => span.name === 'cratis.arc.http.handle');
    const http = servers[0];
    const arcHttp = arcSpans[0];
    if (servers.length !== 1 || arcSpans.length !== 1 || !http || !arcHttp || arcHttp.kind !== SpanKind.INTERNAL) {
        throw Error('Expected one HTTP SERVER span and one Arc INTERNAL span');
    }
    const traceId = http.spanContext().traceId;
    const byId = new Map(spans.filter(span => span.spanContext().traceId === traceId)
        .map(span => [span.spanContext().spanId, span]));
    const ancestors = new Set<string>();
    let parentId = arcHttp.parentSpanContext?.spanId;
    while (parentId && parentId !== http.spanContext().spanId) {
        if (ancestors.has(parentId)) throw Error('Span ancestry has a cycle');
        ancestors.add(parentId);
        const parent = byId.get(parentId);
        if (!parent) throw Error('Missing ancestor span');
        parentId = parent.parentSpanContext?.spanId;
    }
    if (arcHttp.spanContext().traceId !== traceId || parentId !== http.spanContext().spanId) {
        throw Error('Arc span does not descend from HTTP SERVER span');
    }
    if (![...ancestors].some(id => byId.get(id)?.instrumentationScope.name === '@opentelemetry/instrumentation-express')) {
        throw Error('Missing Express instrumentation span in Arc ancestry');
    }
    console.log(http.name, '→', arcHttp.name);
} finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await arc.dispose();
    await sdk.shutdown();
}
```

The host's Node HTTP span is an ancestor of Arc's INTERNAL `cratis.arc.http.handle` span (with Express middleware spans between them); it is not a second Arc SERVER span. `yarn check:observability-recipes` exercises **real HTTP** with Express (HTTP and Express instrumentation), Fastify (HTTP and `@opentelemetry/instrumentation-fastify`, which is deprecated in favor of the maintained `@fastify/otel`), and Hono on its Node server (HTTP instrumentation; no Hono-specific instrumentation installed). For each host it asserts exactly one HTTP SERVER span is an ancestor of the Arc span for a command; for Express and Fastify it also requires a framework instrumentation span in the ancestry. It also checks command and query duration histograms, canonical metric attributes, the deprecated histogram emitted in parallel, tracer and meter scope versions, and the structured-logging recipe below. In-memory export proves local parenting, not remote collector delivery or trace-context propagation through a proxy.

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
| `cratis.arc.command.execute` | Command execution | `cratis.arc.command.type`, `command_type`, `cratis.correlation_id` |
| `cratis.arc.command.validate` | Validate-only pipeline | `cratis.arc.command.type`, `command_type`, `cratis.correlation_id` |
| `cratis.arc.command.filter` | Command validation/filter stage | `cratis.arc.command.type`, `command_type`, `cratis.correlation_id` |
| `cratis.arc.query.perform` | Snapshot query or observable source open | `cratis.arc.query.name`, `query_name`, `cratis.correlation_id` |
| `cratis.arc.query.filter` | Query validation/filter stage | `cratis.arc.query.name`, `query_name`, `cratis.correlation_id` |
| `cratis.arc.http.handle` | Recognized Arc HTTP endpoint (INTERNAL) | `http.request.method`, `http.route`, `cratis.correlation_id` |
| `cratis.arc.query.emission` | Observable current value or subsequent delivery | `cratis.arc.query.name`, `query_name`, `cratis.correlation_id` |
| `cratis.arc.query.subscribe` | Parent scope lifetime, including observable snapshots | `cratis.arc.query.name`, `query_name`, `cratis.correlation_id` |
| `cratis.arc.identity.resolve` | Identity details provider resolution | `cratis.correlation_id` |

Command spans also carry `cratis.arc.command.type`; query spans, including subscriptions and emissions, also carry `cratis.arc.query.name`. These canonical attributes and the retained `command_type` and `query_name` tags contain registered qualified names, not payloads.

The command execution, validation, and filter spans and the query-perform span use the .NET pipeline names. The HTTP, emission, and subscription spans are Node-specific: .NET uses ASP.NET request instrumentation and does not have a per-emission span.

## Metrics

| Instrument | Unit | What it measures |
| --- | --- | --- |
| `cratis.arc.command.duration` | `s` | Full command execution; `cratis.arc.command.type`, `cratis.arc.command.outcome` |
| `cratis.arc.command.outcomes` | `{command}` | One count per command execution; the same attributes as command duration |
| `cratis.arc.query.duration` | `s` | Snapshot query execution or observable source open; `cratis.arc.query.name`, `cratis.arc.query.transport`, `cratis.arc.query.outcome` |
| `cratis.arc.operation.duration` (deprecated) | `s` | Each pipeline stage and operation, tagged with `operation` and the original type, name, or route tags |
| `cratis.arc.subscription.duration` | `s` | Observable subscription lifetime; `cratis.arc.query.name` and deprecated `query_name` |

The four duration instruments are histograms in seconds; `cratis.arc.command.outcomes` is a monotonic counter. All have descriptions and use the `Cratis.Arc` meter. The tracer and meter scope version is the `@cratis/arc.core` package version, compiled from a generated `Version.ts` constant. `yarn set-version` updates Core's and CodeAnalysis's constants with the manifests; `yarn set-version --check` detects missing or stale constants. Runtime code does not import or bundle the package manifest, and builds no longer emit `dist/package.json`.

The new command and query histograms measure completed executions, including failed executions. They do not count filter stages, validate-only commands, or observable emissions as additional executions. Their attributes match the canonical span keys and contain registered command types or query names and fixed outcome/transport values—never correlation IDs, tenant IDs, or payloads. Each meter retains at most 1,000 distinct command types and 1,000 query names; further names become `_other`, as in .NET. Query and subscription metrics share the query-name limit. Legacy metric names and routes are bounded too. Unknown direct command/query names are rejected before the TypeScript pipeline opens and produce no execution metric; unlike .NET, they do not produce a query metric labeled `_other`.

`cratis.arc.operation.duration` is deprecated and remains emitted alongside the new instruments for one minor release. Migrate command and query latency dashboards to the new names and canonical attribute keys before it is removed; do not sum the old and new metrics, which overlap. The old instrument retains its original measurements and attribute keys during this transition, with name overflow folded into `_other`. Subscription duration now records `cratis.arc.query.name` alongside `query_name`; the old key remains for one minor release.

### Outcomes and transports

Outcome classification follows Arc for .NET's result classifier in this order:

1. Unauthorized results use `authorization`, even if they also contain exceptions or validation failures.
2. Exception results (or thrown failures without a result) use `cancelled` if the execution's `AbortSignal` is aborted, otherwise `error`. An `AbortError` alone does not imply cancellation.
3. Results without validation issues use `success`, even if the signal was subsequently aborted.
4. Validation with `constraintViolation` or `concurrencyViolation` reasons uses `append_rejected`; other validation uses `validation`. Chronicle append rejections already carry these reasons. Messages, members, and arbitrary reason values never become metric labels.

Commands use all six values. Queries normally use `success`, `validation`, `authorization`, `cancelled`, and `error`; as with .NET's shared classifier, a custom query filter returning a constraint/concurrency validation reason is classified as `append_rejected`. The outcome is also recorded on execute/validate/perform spans. Existing TypeScript span error-status behavior is unchanged: exception results still mark spans as errors, including cancellation; .NET marks only the `error` outcome as a failed span.

`cratis.arc.query.transport` uses exactly the .NET values:

- `snapshot`: an ordinary query result, including successful null/undefined data.
- `observable`: an observable source returned by the query pipeline. This includes current-value snapshots, SSE, WebSocket, and multiplexed-hub subscriptions; those delivery protocols do not get separate metric values.
- `unknown`: a failed result without data, or an exception without a result, including authorization or validation rejection before a source opens.

Transport describes the returned result, not the requested protocol. Both TypeScript observable sources and .NET subjects/async enumerables map to `observable`. Emissions and subscription closure do not add query-duration measurements or change the source-open outcome. Validate-only commands do not increment the command counter.

### Public constants

Import `WellKnownTelemetryNames`, `OperationOutcome`, and `QueryTransport` from `@cratis/arc.core`. The enums expose the values above. `WellKnownTelemetryNames` exposes:

- Scope and instruments: `scope`, `commandDuration`, `commandOutcomes`, `queryDuration`, `operationDuration` (deprecated), `subscriptionDuration`.
- Attributes: `commandType`, `commandOutcome`, `queryName`, `queryOutcome`, `queryTransport`.
- Spans: `commandExecuteSpan`, `commandValidateSpan`, `commandFilterSpan`, `queryPerformSpan`, `queryFilterSpan`, `queryEmissionSpan`, `querySubscribeSpan`, `httpHandleSpan`, `identityResolveSpan`.

## What Arc does not instrument

- **Foreign routes.** Routes your host serves outside Arc get no Arc spans. Use your host's HTTP instrumentation for those.
- **W3C trace context.** A valid configured [correlation header](reference/capabilities.md#security-identity-tenancy-and-correlation) is reflected in `cratis.correlation_id` and in the response. It is not a W3C trace-context propagator; configure your host instrumentation for `traceparent`.

The Kotlin/JVM adapter uses Micrometer observations; it is not an OpenTelemetry SDK dependency of the TypeScript core.

## Next steps

- [Configuration](configuration/index.md) sets the correlation header name with `correlationId.httpHeader`.
- [Diagnostics](reference/diagnostics.md) lists the other signals Arc produces when something goes wrong.

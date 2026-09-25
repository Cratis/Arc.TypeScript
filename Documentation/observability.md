---
title: Observe Arc requests
description: Subscribe to Arc for TypeScript tracing and operation durations with an application-owned OpenTelemetry SDK.
---

A slow command in production is hard to explain from logs alone. Was the time spent in validation, in your handler, or in the HTTP layer? Arc for TypeScript emits spans for each pipeline stage and an operation-duration histogram through `@opentelemetry/api`, so the tracing backend you already run can answer that.

Arc only emits. Core does not install an exporter, context manager, or SDK, so it stays usable without any tracing infrastructure. You install and start an SDK **in your application**, before you build the Arc server. Arc never sends raw exception messages to spans, including in development.

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

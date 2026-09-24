---
title: Observe Arc requests
description: Subscribe to Arc for TypeScript tracing and operation durations with an application-owned OpenTelemetry SDK.
---
<!-- Copyright (c) Cratis. All rights reserved.
Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

Arc for TypeScript emits spans and an operation-duration histogram through
`@opentelemetry/api`. Install and start an SDK **in your application** before
building the Arc server. Core does not install an exporter, context manager or
SDK, so it remains usable without tracing infrastructure.

## Start a local console exporter

These packages are not published yet. From this source checkout, run
`yarn install && yarn build`; the workspace provides the SDK development
dependencies. Save the following as `observability-example.mjs` at the root
and run `node observability-example.mjs`. In a future application using a
published package, install `@opentelemetry/sdk-node`,
`@opentelemetry/sdk-trace-base`, `@opentelemetry/sdk-metrics`, and `zod` in that
application instead of depending on the SDK from core.

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

Run with Node 22 or newer. You should see a query result, then spans and a
`cratis.arc.operation.duration` histogram from the `Cratis.Arc` source/meter.
Replace the console exporters with exporters configured for your collector in
the host. If the SDK is started after Arc is imported, Arc uses the API's
proxy tracer; initialize before sending requests so nothing is missed.

## Span names

| Span | Boundary | Attributes |
| --- | --- | --- |
| `cratis.arc.command.execute` | Command execution | `commandType`, `cratis.correlation_id` |
| `cratis.arc.command.validate` | Validate-only pipeline | `commandType`, `cratis.correlation_id` |
| `cratis.arc.command.filter` | Command validation/filter stage | `commandType`, `cratis.correlation_id` |
| `cratis.arc.query.perform` | Snapshot query or observable source open | `queryName`, `cratis.correlation_id` |
| `cratis.arc.query.filter` | Query validation/filter stage | `queryName`, `cratis.correlation_id` |
| `cratis.arc.http.handle` | Recognized Arc HTTP endpoint | `http.request.method`, `http.route`, `cratis.correlation_id` |
| `cratis.arc.query.emission` | Observable current value or subsequent delivery | `queryName`, `cratis.correlation_id` |
| `cratis.arc.query.subscribe` | Scope lifetime, including observable snapshots | `queryName`, `cratis.correlation_id` |

The first five span names use the .NET pipeline names. The last three are
Node-specific: .NET uses ASP.NET request instrumentation and does not have a
per-emission span. `commandType` and `queryName` are the registered qualified names,
not payloads. The `cratis.arc.operation.duration` histogram records seconds under `Cratis.Arc`
with `operation` and the applicable type/name or route tags;
`cratis.arc.subscription.duration` measures open subscription lifetimes. .NET's core pipeline exposes a meter
but does not record command/query durations. Arc does not instrument foreign
routes; use your host's HTTP instrumentation for those. A valid configured
[correlation header](reference/capabilities.md#security-identity-tenancy-and-correlation)
is reflected in `cratis.correlation_id` and the response. It is not a W3C
trace-context propagator; configure your host instrumentation for `traceparent`.

The Kotlin/JVM adapter uses Micrometer observations; it is not an OpenTelemetry
SDK dependency of the TypeScript core.

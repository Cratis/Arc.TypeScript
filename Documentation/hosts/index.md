---
title: Host adapters
description: Mount Arc in Express, Fastify, Hono, or a Fetch API host; know which runtime features each host supports.
---

Your team already runs a web framework, with its middleware, health checks, and deployment story. You do not want a second server for Arc. A host adapter mounts the Arc application into the framework you have and leaves every route Arc does not own to that framework.

:::caution[Source preview]
The adapters are not published to npm. Pack the adapter you need from a built clone of this repository and install the tarball in your project, or put your application under `Samples/` in the clone and reference the adapter with the `workspace:^` protocol. [Create an application](../getting-started/create-an-application.md) shows both paths, and [Packages](../reference/packages.md) lists the package names.
:::

## Before you start

- An ES module package (`"type": "module"`). The adapters need Node.js 22 or later; building the workspace needs 22.19 or later, and Node.js 24 LTS is recommended.
- A built Arc application. Keep it in its own module so every host imports the same instance:

```typescript title="arc.ts"
import { ArcApplication } from '@cratis/arc.core';
import { Tasks } from './Features/Tasks/Tasks.js';
import { metadata } from './Features/generatedMetadata.js';

const builder = ArcApplication.createBuilder();
builder.useGeneratedMetadata(metadata);
builder.services.addSingleton(Tasks);
await builder.discover(new URL('./Features/', import.meta.url));
export const arc = await builder.build();
```

This is the [Tasks sample's bootstrap](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/main.ts) without `app.run()`, because the framework owns the listener. `metadata` is the module that `arc-proxygenerator --metadata` writes; see [Generate artifact metadata](../proxy-generation/generated-artifact-metadata.md). Register your own services the way the sample registers `Tasks`. `build()` checks the artifacts and options and throws when something is wrong, so a mistake shows up when the process starts rather than on the first request.

| Package | Exports | Framework peer range |
| --- | --- | --- |
| `@cratis/arc.express` | `cratisArc(arc)` middleware and `.injectWebSocket(listener)` | `express` `^5.0.0` |
| `@cratis/arc.fastify` | `app.register(cratisArc, { arc })` (WebSockets on by default) | `fastify` `^5.0.0` |
| `@cratis/arc.hono` | `app.use(cratisArc(arc))`; Node: `serveCratisArc` | `hono` `^4.0.0`; optional `@hono/node-server` `^1.19.11` for Node hosting |
| `@cratis/arc.core/hosting` | `attachNodeWebSockets` and adapter hosting primitives | None |

Each adapter accepts a built `ArcApplication` or low-level `ArcServer`.

## Pick your framework

- [Express](express.md): one middleware, mounted before body parsers.
- [Fastify](fastify.md): an encapsulated plugin with its own raw-body parser.
- [Hono](hono.md): middleware on a Fetch API framework, with raw-path checks on Node.
- [Fetch API runtimes](fetch-runtimes.md): explicitly registered artifacts over `app.fetch` for Bun, Deno, Cloudflare Workers with `nodejs_compat`, and Next.js Node route handlers. The package is an unpublished source preview; read the verification boundary before deployment.

Express needs a listener attach step for WebSockets; Fastify's plugin and Hono's Node helper attach them in the setup call, described in [WebSockets](websockets.md). To use a principal your framework already verified, see [Native principal](native-principal.md).

## What every adapter shares

The adapters add no Arc behavior of their own. Each one:

- dispatches only requests whose path exactly matches an Arc route, on a fixed internal origin, so a crafted `Host` header cannot select a different operation (Express and Fastify compare the raw path; Hono checks the raw request-target only on `@hono/node-server`);
- hands Arc the unparsed body and lets Arc enforce `hosting.maxBodyBytes`;
- passes a cancellation signal that becomes `context.signal`; pass it to anything that accepts one, such as `fetch` or a database driver;
- serves the same routes: commands, validation routes, queries, observable queries, and the `/.cratis` and `/openapi.json` endpoints listed in the [HTTP contract reference](../reference/http-contract.md).

## Where adapters differ

| Area | Express | Fastify | Hono |
| --- | --- | --- | --- |
| Registration | One middleware, before body parsers | Encapsulated plugin; routes exist once the app is ready | One middleware |
| Request bodies | Raw request stream | Raw buffer from a scoped catch-all parser | The Fetch API request body |
| Body size | Arc's `hosting.maxBodyBytes` | Fastify's `bodyLimit` first, then `hosting.maxBodyBytes` | Arc's `hosting.maxBodyBytes` |
| Unknown path | Falls through to your routes; Express's own 404 carries no Arc correlation header | Fastify's 404 | Falls through to your routes |
| `context.signal` aborts | When the client disconnects before the response finishes | When the client disconnects before the response finishes | When the signal of the request Hono received aborts; depends on the server running Hono |
| Application type | `Express` | `FastifyInstance` | `Hono<E>` for any `Env` type |

## Ownership and shutdown

The framework owns its listener. Mounting an application does not make the adapter own shutdown: close the framework's server, then call `await arc.dispose()` to dispose Arc's services.

## Related

- [Hosting overview](../overview.md)
- [Arc.Core and the standalone host](../core/index.md) for hosting without a framework
- [Calling commands from code](../commands/calling-commands-from-code.md)

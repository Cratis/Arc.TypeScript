---
title: Host Arc in Express, Fastify, or Hono
description: Mount an ArcServer in an Express 5, Fastify 5, or Hono 4 application, and know what each adapter does with paths, bodies, and client disconnects.
---

`ArcServer` owns Arc behavior but never listens on a port. A host adapter connects it to the web framework your application already uses, and leaves every route Arc does not own to that framework. This guide mounts the same server in Express, Fastify, and Hono.

:::note[Unpublished source]
The adapters are not published to npm. They do not support observable queries. See the [capability reference](../reference/capabilities.md).
:::

## Before you start

- An ES module package (`"type": "module"`). The adapters need Node.js 22 or later; building the workspace needs 22.19 or later, and Node.js 24 LTS is recommended.
- A workspace inside a clone of this repository, built with `yarn build`, as described in [Get started](../getting-started.md). Until the packages are published, reference them the way `Samples/Tasks/package.json` does, with the `workspace:^` protocol.
- Zod 4 for schemas.

| Package | Export | Host framework peer range |
| --- | --- | --- |
| `@cratis/arc.server` | `ArcServer`, `defineCommand`, `defineQuery`, and result helpers | None |
| `@cratis/arc.server.express` | `mountExpress(app, server)` | `express` `^5.0.0` |
| `@cratis/arc.server.fastify` | `mountFastify(app, server)` | `fastify` `^5.0.0` |
| `@cratis/arc.server.hono` | `mountHono(app, server)` | `hono` `^4.0.0` |

## Define the server once

Keep your definitions and the `ArcServer` in their own module, so every host imports the same instance:

```typescript title="arc.ts"
import { ArcServer, defineCommand } from '@cratis/arc.server';
import { z } from 'zod';

const echo = defineCommand({
    name: 'Echo',
    schema: z.object({ value: z.string() }),
    handle: ({ value }) => value
});

export const arc = new ArcServer({ commands: [echo] });
```

The constructor validates the definitions and options, and throws when something is wrong, so a mistake shows up when the process starts, not on the first request. [Configure the server](configuration.md#what-the-constructor-rejects) lists what it rejects.

## Mount in Express 5

```typescript title="server.ts"
import express from 'express';
import { mountExpress } from '@cratis/arc.server.express';
import { arc } from './arc.js';

const app = express();
mountExpress(app, arc);
app.use(express.json());
app.get('/health', (_request, response) => { response.send('ok'); });
app.listen(3000, '127.0.0.1');
```

`mountExpress` adds one middleware. It compares the raw request path, before any normalization, with Arc's registered routes. Only an exact match is handled by Arc; every other request, including spellings such as `//api/echo`, `/x/../api/echo`, or `/api/%2e%2e/api/echo` that would only match after normalization, goes to `next()`. The adapter builds the Fetch API request on a fixed internal origin and never uses the `Host` header for routing. An unexpected error in the adapter is passed to Express with `next(error)`.

:::caution[Mount Arc before body parsers]
Arc reads the raw request body itself. If `express.json()` or another body parser runs first, it consumes the body, and Arc answers every command with 400 `malformedRequest`. Call `mountExpress` before you add body parsers, as in the example.
:::

## Mount in Fastify 5

```typescript title="server.ts"
import Fastify from 'fastify';
import { mountFastify } from '@cratis/arc.server.fastify';
import { arc } from './arc.js';

const app = Fastify();
mountFastify(app, arc);
app.get('/health', async () => 'ok');
await app.listen({ port: 3000, host: '127.0.0.1' });
```

`mountFastify` registers an encapsulated plugin that owns Arc's routes. Inside that plugin, one catch-all content type parser hands every body to Arc as a raw buffer, whatever its content type, including vendor types such as `application/vnd.acme+json`. Arc then decodes it as strict UTF-8 JSON, so invalid UTF-8 answers 400 `malformedRequest` with or without `Content-Length`. The parsers of your own application are not changed.

Each Arc route is registered for GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD, and `QUERY`, and Arc answers the methods it does not accept with 405 and an `Allow` header. Any other method is left to Fastify's own routing. The handler dispatches only when the raw request path equals the route Fastify matched, on a fixed internal origin, so a crafted `Host` header cannot select a different operation.

Fastify loads plugins lazily, so Arc's routes exist once the application is ready: after `listen`, `ready`, or the first `inject`. Do not register your own routes on Arc's paths; Fastify rejects the duplicate when it loads the plugin.

:::caution[Fastify's body limit applies first]
Fastify enforces its own `bodyLimit`, 1 MiB by default, before Arc reads the body. A larger body gets Fastify's 413 response, not an Arc result. To accept larger bodies, raise both `bodyLimit` and Arc's `maxBodyBytes`.
:::

## Mount in Hono 4

```typescript title="server.ts"
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { mountHono } from '@cratis/arc.server.hono';
import { arc } from './arc.js';

const app = new Hono<{ Variables: { startedAt: number } }>();
app.use('*', async (context, next) => { context.set('startedAt', Date.now()); await next(); });
mountHono(app, arc);
app.get('/health', context => context.text(`ok since ${context.get('startedAt')}`));
serve({ fetch: app.fetch, port: 3000, hostname: '127.0.0.1' });
```

`mountHono` adds middleware for every path and accepts an app with your own `Env` type, including `Bindings` and `Variables`. Hono already uses Fetch API requests, so the adapter hands the request to Arc unchanged and returns Arc's response. Requests for other paths continue to your routes. Mount Arc before you add routes. To run on Node.js, add `@hono/node-server` as the Tasks sample does.

## What every adapter serves

| Path | Methods | Answer |
| --- | --- | --- |
| A command route, such as `/api/tasks/create` | POST | Command result |
| `<command route>/validate` | POST | Command result after authorization and validation; the handler never runs |
| A query route, such as `/api/tasks/list` | GET, and `QUERY` unless disabled | Query result; `QUERY` responses carry `Cache-Control: no-store` |
| `/.cratis/commands`, `/.cratis/queries` | GET | Command and query metadata, including the JSON Schema of each input |
| `/.cratis/identity-details/schema` | GET | The `identityDetailsSchema` option, or `{}` |
| `/openapi.json` | GET | An OpenAPI 3.1 document for the registered operations |

The description endpoints do not run authentication handlers. Routes and options are covered in [Configure the server](configuration.md). To call the server without a host framework, see [Call Arc from code](direct-calls.md).

## Cancellation

Every callback receives `context.signal`, an `AbortSignal`. Pass it to anything that accepts one, such as `fetch` or the MongoDB driver, so abandoned work stops.

| Adapter | When `context.signal` aborts |
| --- | --- |
| Express | When the client disconnects before the response is finished |
| Fastify | When the client disconnects before the response is finished |
| Hono | When the signal of the request Hono received aborts; that depends on the server running Hono |

## Adapter differences and limitations

| Area | Express | Fastify | Hono |
| --- | --- | --- | --- |
| Registration | One middleware, before body parsers | Encapsulated plugin, routes available once the app is ready | Middleware for every path |
| Request bodies | Raw request stream | Raw buffer from a scoped catch-all parser | The Fetch API request body |
| Body size | Arc's `maxBodyBytes` | Fastify's `bodyLimit` first, then `maxBodyBytes` | Arc's `maxBodyBytes` |
| Unknown path | Falls through to your routes; Express's own 404 has no Arc correlation header | Fastify's 404 | Falls through to your routes |
| Application type | `Express` | `FastifyInstance` | `Hono<E>` for any `Env` type `E` |

In every adapter:

- Observable queries, server-sent events, and WebSocket transports are not implemented.
- The principal comes only from `ArcServer`'s own authentication handlers. An adapter does not pick up a user authenticated by the host framework's middleware. See [Validate and authorize commands and queries](validation-and-authorization.md).
- Static files, SPA fallback, and a standalone host without a web framework are not provided.

## Related

- [Call Arc from code](direct-calls.md)
- [Configure the server](configuration.md)
- [Capability reference](../reference/capabilities.md)

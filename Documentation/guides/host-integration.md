---
title: Host Arc in Express, Fastify, or Hono
description: Mount an ArcServer in an Express 5, Fastify 5, or Hono 4 application, and know what each adapter does with paths, bodies, and client disconnects.
---

`ArcServer` owns Arc behavior but never listens on a port. A host adapter connects it to the web framework your application already uses, and leaves every route Arc does not own to that framework. This guide mounts the same server in Express, Fastify, and Hono.

:::note[Unpublished source]
The adapters are not published to npm. Observable queries use the same HTTP route plus an opt-in Node WebSocket bridge; see [Stream an observable query](observable-queries.md) and the [capability reference](../reference/capabilities.md).
:::

## Before you start

- An ES module package (`"type": "module"`). The adapters need Node.js 22 or later; building the workspace needs 22.19 or later, and Node.js 24 LTS is recommended.
- A workspace inside a clone of this repository, built with `yarn build`, as described in [Get started](../getting-started.md). Until the packages are published, reference them the way `Samples/Tasks/package.json` does, with the `workspace:^` protocol.
- Zod 4 for schemas.

| Package | Export | Host framework peer range |
| --- | --- | --- |
| `@cratis/arc.core` | `ArcServer`, `defineCommand`, `defineQuery`, `defineObservableQuery`, and result helpers | None |
| `@cratis/arc.core/hosting` | `attachNodeWebSockets` and adapter hosting primitives | None |
| `@cratis/arc.express` | `mountExpress(app, server)`, `mountExpressWebSockets(listener, server)` | `express` `^5.0.0` |
| `@cratis/arc.fastify` | `mountFastify(app, server)`, `mountFastifyWebSockets(app, server)` | `fastify` `^5.0.0` |
| `@cratis/arc.hono` | `mountHono(app, server)`, `mountHonoWebSockets(app, server)` | `hono` `^4.0.0`; optional `@hono/node-server` for the Node host |

## Define the server once

Keep your definitions and the `ArcServer` in their own module, so every host imports the same instance:

```typescript title="arc.ts"
import { ArcServer, defineCommand } from '@cratis/arc.core';
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
import { mountExpress } from '@cratis/arc.express';
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
import { mountFastify } from '@cratis/arc.fastify';
import { arc } from './arc.js';

const app = Fastify();
mountFastify(app, arc);
app.get('/health', async () => 'ok');
await app.listen({ port: 3000, host: '127.0.0.1' });
```

`mountFastify` registers an encapsulated plugin that owns Arc's routes. Inside that plugin, one catch-all content type parser hands every body to Arc as a raw buffer, whatever its content type, including vendor types such as `application/vnd.acme+json`. Arc then decodes it as strict UTF-8 JSON, so invalid UTF-8 answers 400 `malformedRequest` with or without `Content-Length`. The parsers of your own application are not changed.

Command and query routes are registered for GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD, and `QUERY`; root metadata/identity/discovery routes are registered for those standard methods without `QUERY`. Arc answers methods it receives but does not accept with 405 and an `Allow` header. Other methods are left to Fastify's own routing (often 404). The handler dispatches only when the raw request path equals the route Fastify matched, on a fixed internal origin, so a crafted `Host` header cannot select a different operation.

Fastify loads plugins lazily, so Arc's routes exist once the application is ready: after `listen`, `ready`, or the first `inject`. Do not register your own routes on Arc's paths; Fastify rejects the duplicate when it loads the plugin.

:::caution[Fastify's body limit applies first]
Fastify enforces its own `bodyLimit`, 1 MiB by default, before Arc reads the body. A larger body gets Fastify's 413 response, not an Arc result. To accept larger bodies, raise both `bodyLimit` and Arc's `maxBodyBytes`.
:::

## Mount in Hono 4

```typescript title="server.ts"
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { mountHono } from '@cratis/arc.hono';
import { arc } from './arc.js';

const app = new Hono<{ Variables: { startedAt: number } }>();
app.use('*', async (context, next) => { context.set('startedAt', Date.now()); await next(); });
mountHono(app, arc);
app.get('/health', context => context.text(`ok since ${context.get('startedAt')}`));
serve({ fetch: app.fetch, port: 3000, hostname: '127.0.0.1' });
```

`mountHono` adds middleware for every path and accepts an app with your own `Env` type, including `Bindings` and `Variables`. Hono uses Fetch API requests; the adapter copies the request onto a fixed internal origin before handing it to Arc and returns Arc's response. On `@hono/node-server` it also checks the raw request-target before dispatch: URL normalization and absolute-form paths must not promote foreign paths into Arc endpoints. Requests for other paths continue to your routes. Mount Arc before you add routes. To run on Node.js, add `@hono/node-server` as the Tasks sample does. Other Hono runtimes do not expose raw request-target spelling; they cannot attest the same raw-path defense without host-specific validation.

## Mount observable WebSockets on Node.js

Mount the HTTP adapter as above. WebSocket upgrades need a separate, framework-specific step:

- **Express:** call `mountExpressWebSockets(listener, arc, async rawRequest => verifiedContext)` on the listener returned by `app.listen()`. Express HTTP middleware does **not** run on Node `upgrade` requests: its session, authentication, CORS and rate-limiting middleware cannot authorize the socket. The callback receives a raw `IncomingMessage`, not an Express request: `trust proxy` and `req.protocol` do not apply. Authenticate it with a trusted session or Arc authentication handlers. If a proxy terminates TLS, validate the proxy connection against a fixed trusted proxy list before parsing `Forwarded` or `X-Forwarded-Proto` and `X-Forwarded-Host`; reject untrusted or ambiguous values, then return trusted `secure` and `authority` values. Never trust forwarded headers merely because they are present.
- **Fastify:** call `mountFastifyWebSockets(app, arc, async fastifyRequest => verifiedContext)` **before** `mountFastify(app, arc)` and before `listen()`. If your app uses `@fastify/websocket`, register that plugin **before** `mountFastifyWebSockets`; Arc uses the already registered plugin rather than registering another. Registering it afterward causes a duplicate decorator error at boot. Fastify's `onRequest`, `preValidation` and `preHandler` hooks run before the upgrade. `app.close()` disposes Arc-owned sockets and subscriptions, **not** `arc` or its owned services; call `await arc.dispose()` separately.
- **Hono:** call `mountHono(app, arc)`, then `const sockets = mountHonoWebSockets(app, arc, async context => verifiedContext)`, before starting `@hono/node-server`. After `const listener = serve({ fetch: app.fetch, ... })`, call `sockets.injectWebSocket(listener)`; call `await sockets.dispose()` at shutdown. If your app already has a `createNodeWebSocket({ app })` helper, pass it as the fourth argument to `mountHonoWebSockets(app, arc, native, helper)` and call **only** `helper.injectWebSocket(listener)`: Arc does not own that shared listener. Ordinary GETs pass through the WS route to your HTTP handlers. The helper runs application middleware, and the Node TLS socket supplies `secure` unless trusted native context overrides it. `@hono/node-server` is an optional peer needed only for this Node host; other Hono runtimes need their own verified bridge. Dispose `arc` after its sockets.

For a fixed loopback TLS proxy, an Express resolver can parse and validate its forwarded authority explicitly. Adapt the trusted proxy address and host to your deployment; never accept these headers from direct clients:

```typescript
mountExpressWebSockets(listener, arc, request => {
    if (request.socket.remoteAddress !== '127.0.0.1') throw new Error('Untrusted proxy');
    const protocol = request.headers['x-forwarded-proto'];
    const host = request.headers['x-forwarded-host'];
    if (protocol !== 'https' || host !== 'app.example.com') throw new Error('Invalid forwarded authority');
    return { secure: true, authority: host };
});
```

The example does not supply `remoteAddress`, so anonymous per-caller connection and subscription caps group callers by the proxy's address. If you need individual anonymous caller caps, validate `X-Forwarded-For` against your trusted proxy chain and supply that verified client address as `remoteAddress`; never pass a raw client-supplied header.

Each bridge checks exact raw paths and the configured `allowedOrigins` before upgrade. By default a present browser `Origin` must match the trusted transport's scheme and authority; `allowedOrigins: ['http://localhost:5173']` replaces that default with an explicit list, and an async predicate can implement a host policy. Include your application origin in the list when it must remain allowed. A trusted `native` callback can set `secure` and `authority` for TLS-terminating proxies. Arc never trusts `X-Forwarded-*` by itself. An absent Origin is permitted for native clients; it is **not** proof of authentication.

## What every adapter serves

| Path | Methods | Answer |
| --- | --- | --- |
| A command route, such as `/api/tasks/create` | POST | Command result |
| `<command route>/validate` | POST | Command result after authorization and validation; the handler never runs |
| A query route, such as `/api/tasks/list` | GET, and `QUERY` unless disabled | Query result; `QUERY` responses carry `Cache-Control: no-store` |
| An observable query route | GET, optional `QUERY`, SSE via `Accept`, direct WS upgrade | Current snapshot, stream of direct SSE query results, or direct WS `Data` frames |
| `/.cratis/queries/ws` | WS upgrade | Multiplexed WS query hub |
| `/.cratis/queries/sse` and `/sse/subscribe`, `/sse/unsubscribe` | GET and authenticated POST | Multiplexed SSE stream and caller-bound controls |
| `/.cratis/commands`, `/.cratis/queries` | GET | Command and query metadata, including the JSON Schema of each input |
| `/.cratis/identity-details/schema` | GET | Provider Zod schema as JSON Schema, legacy `identityDetailsSchema`, or `{}` |
| `/.cratis/me` | GET when `identityDetails` is set | 401 anonymous, 403 provider denied, 200 identity JSON with display cookie |
| `/.cratis/users`, `/.cratis/tenants` | GET | `[]` by default; opt-in development discovery |
| `/.cratis/queries/health` | GET and `QUERY` when opted in | Caller-scoped observable hub health; requires authentication |
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

- A principal comes from Arc authentication handlers unless you set `nativePrincipal: true` and provide an explicit host-verified principal callback as the third argument to `mountExpress`, `mountFastify`, or `mountHono`. The two authentication modes cannot be combined. The callbacks also accept an optional `authority` known from trusted host configuration (not the request `Host` header). Express/Fastify use the actual Node TLS socket by default, but a trusted callback can override `secure` and `authority` when a verified proxy terminates TLS. Hono on Node infers `secure` from its TLS socket; proxy `secure`/`authority` and a host-verified `principal` still require a trusted callback. Do not forward unverified headers into these callbacks.
- `server.handle(request, nativeContext?)` also accepts an async callback returning trusted native context; adapters invoke it inside Arc's protected error boundary so callback errors become redacted 500 responses with correlation and logging. This is a server-side privileged integration seam. Never populate `nativeContext` from browser-supplied properties, cookies, `X-Forwarded-*`, or the Fetch URL. A display cookie cannot authenticate a caller. See [Configure the server](configuration.md#describe-identity-details-and-operations).
- For static files, SPA fallback, and a standalone host without a web framework, use [Host Arc directly in Node.js](standalone-host.md).

## Related

- [Call Arc from code](direct-calls.md)
- [Configure the server](configuration.md)
- [Capability reference](../reference/capabilities.md)

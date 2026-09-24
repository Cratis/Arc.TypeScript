---
title: WebSockets
description: Mount WebSocket upgrades for observable queries in Express, Fastify, and Hono, authenticate them, and configure Origin checks and proxy trust.
---

Observable queries stream over server-sent events on the ordinary HTTP route, which every adapter serves once mounted. WebSockets are different: an upgrade does not travel through the framework's request pipeline in the same way, so each adapter has a separate mount call. The standalone Node host handles upgrades itself; see [Arc.Core](../core/index.md#bring-your-own-node-server) for your own Node server.

Mount the HTTP adapter first, as described on its page, then add the WebSocket step for your framework. `arc` below is the built `ArcApplication` from [Host adapters](index.md#before-you-start).

## Express

```typescript title="server.ts"
import express from 'express';
import { mountExpress, mountExpressWebSockets } from '@cratis/arc.express';
import { arc } from './arc.js';

const app = express();
mountExpress(app, arc);
const listener = app.listen(3000, '127.0.0.1');
const closeSockets = mountExpressWebSockets(listener, arc);
```

Call `mountExpressWebSockets(listener, arc, native?)` on the listener returned by `app.listen()`, and `await closeSockets()` at shutdown. Express HTTP middleware does **not** run on Node `upgrade` requests: session, authentication, CORS, and rate-limiting middleware cannot authorize the socket. The optional `native` callback receives a raw `IncomingMessage`, not an Express request, so `trust proxy` and `req.protocol` do not apply. Authenticate upgrades with Arc authentication handlers or a trusted session lookup in that callback.

## Fastify

Call `mountFastifyWebSockets(app, arc.server, native?)` **before** `mountFastify(app, arc)` and before `listen()`. If your application uses `@fastify/websocket`, register that plugin **before** `mountFastifyWebSockets`; Arc uses the registered plugin instead of adding another. Registering it afterward causes a duplicate decorator error at boot.

Fastify's `onRequest`, `preValidation`, and `preHandler` hooks run before the upgrade. `app.close()` disposes Arc-owned sockets and subscriptions, **not** the Arc application or its services; call `await arc.dispose()` separately.

## Hono

```typescript title="server.ts"
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { mountHono, mountHonoWebSockets } from '@cratis/arc.hono';
import { arc } from './arc.js';

const app = new Hono();
mountHono(app, arc);
const sockets = mountHonoWebSockets(app, arc.server);
const listener = serve({ fetch: app.fetch, port: 3000, hostname: '127.0.0.1' });
sockets.injectWebSocket(listener);
```

Call `await sockets.dispose()` at shutdown, before disposing `arc`. If your application already has a `createNodeWebSocket({ app })` helper, pass it as the fourth argument, `mountHonoWebSockets(app, arc.server, native, helper)`, and call **only** `helper.injectWebSocket(listener)`: Arc does not own that shared listener. Ordinary GET requests pass through the WebSocket route to your handlers. Hono middleware runs for upgrades, and the Node TLS socket supplies `secure` unless trusted native context overrides it. `@hono/node-server` is needed only for this Node host; other Hono runtimes need their own verified bridge.

## Frame limits

Arc rejects oversized inbound WebSocket frames with close code 1009 on every adapter, even with shared WebSocket infrastructure. Configure a shared plugin or helper's `maxPayload` at or below `maxObservableInboundFrameBytes` (64 KiB by default) so it rejects them before delivery. The other observable limits are in [Configuration](../configuration/index.md#observable-query-limits).

## Origin checks

Each bridge checks exact raw paths and the configured `allowedOrigins` before accepting an upgrade.

- By default, a browser `Origin` that is present must match the trusted transport's scheme and authority.
- `allowedOrigins: ['http://localhost:5173']` replaces that default with an explicit list. Include your application's own origin when it must stay allowed.
- An async predicate `(origin, request, native) => boolean` can implement a host policy.
- An absent `Origin` is permitted for native clients. It is **not** proof of authentication.

## Behind a TLS-terminating proxy

Arc never trusts `X-Forwarded-*` by itself. A trusted `native` callback can set `secure` and `authority` when a verified proxy terminates TLS. Validate the proxy connection against a fixed list before reading forwarded values:

```typescript
mountExpressWebSockets(listener, arc, request => {
    if (request.socket.remoteAddress !== '127.0.0.1') throw new Error('Untrusted proxy');
    const protocol = request.headers['x-forwarded-proto'];
    const host = request.headers['x-forwarded-host'];
    if (protocol !== 'https' || host !== 'app.example.com') throw new Error('Invalid forwarded authority');
    return { secure: true, authority: host };
});
```

Adapt the trusted proxy address and host to your deployment; never accept these headers from direct clients. This example does not supply `remoteAddress`, so anonymous per-caller connection and subscription caps group callers by the proxy's address. For individual anonymous caps, validate `X-Forwarded-For` against your trusted proxy chain and supply the verified client address as `remoteAddress`.

## Related

- [Observable queries](../queries/observable-queries.md)
- [Multiplexed observable queries](../queries/observable-query-demultiplexer.md)
- [Native principal](native-principal.md)

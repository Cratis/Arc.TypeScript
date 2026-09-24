---
title: Hono
description: Mount an Arc application in Hono 4 with your own Env type, run it on Node with @hono/node-server, and know what other Hono runtimes cannot attest.
---

`@cratis/arc.hono` adds middleware to a Hono 4 application. Hono speaks the Fetch API, so the adapter copies the request onto a fixed internal origin, hands it to Arc, and returns Arc's response.

## Mount the application

```typescript title="server.ts"
import { Hono } from 'hono';
import { cratisArc, serveCratisArc } from '@cratis/arc.hono';
import { arc } from './arc.js';

const app = new Hono<{ Variables: { startedAt: number } }>();
app.use('*', async (context, next) => { context.set('startedAt', Date.now()); await next(); });
app.route('/', cratisArc(arc));
app.get('/health', context => context.text(`ok since ${context.get('startedAt')}`));
const hosted = await serveCratisArc(app, arc, { port: 3000, hostname: '127.0.0.1' });
process.once('SIGTERM', () => { void hosted.dispose().then(() => arc.dispose()); });
```

`arc` is the built application from [Host adapters](index.md#before-you-start). `cratisArc(arc)` creates an HTTP/SSE sub-app that continues to your routes for foreign paths. `serveCratisArc` starts a Node listener with WebSocket upgrades and returns its listener and async disposer; it does not dispose `arc`. Mount the sub-app before adding your routes. `mountHono` and `mountHonoWebSockets` remain deprecated aliases.

## Run on Node

To run on Node.js, add `@hono/node-server`, an optional peer dependency. On that server, the adapter also checks the raw request-target before dispatch, so URL normalization and absolute-form paths cannot promote a foreign path into an Arc endpoint.

:::caution[Other Hono runtimes]
Runtimes other than `@hono/node-server` do not expose the raw request-target spelling, so they cannot attest the same raw-path defense without host-specific validation. `context.signal` follows the signal of the request Hono received, which depends on that runtime.
:::

## Pass a verified principal

`cratisArc(arc, native)` accepts a callback returning trusted native context. On Node, `secure` comes from the TLS socket; a proxy's `secure` and `authority`, and a host-verified `principal`, still require a trusted callback. See [Native principal](native-principal.md).

## Observable queries over WebSockets

`serveCratisArc(app, arc, { port, native? })` installs observable WebSockets on the Node listener; HTTP/SSE-only Fetch runtimes can use `app.route('/', cratisArc(arc))` with their own server. Other runtimes need a separately verified WebSocket upgrade bridge. The pinned `@hono/node-server` 1.x does not export the Hono WebSocket upgrade helper, so this Node adapter still uses `@hono/node-ws` internally. See [WebSockets](websockets.md#hono).

## Related

- [Host adapters](index.md)
- [Express](express.md) and [Fastify](fastify.md)

---
title: Hono
description: Mount an Arc application in Hono 4 with your own Env type, run it on Node with @hono/node-server, and know what other Hono runtimes cannot attest.
---

`@cratis/arc.hono` adds middleware to a Hono 4 application. Hono speaks the Fetch API, so the adapter copies the request onto a fixed internal origin, hands it to Arc, and returns Arc's response.

## Mount the application

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

`arc` is the built application from [Host adapters](index.md#before-you-start). `mountHono` adds middleware for every path and accepts an app with your own `Env` type, including `Bindings` and `Variables`. Requests for other paths continue to your routes. Mount Arc before you add routes.

## Run on Node

To run on Node.js, add `@hono/node-server`, an optional peer dependency. On that server, the adapter also checks the raw request-target before dispatch, so URL normalization and absolute-form paths cannot promote a foreign path into an Arc endpoint.

:::caution[Other Hono runtimes]
Runtimes other than `@hono/node-server` do not expose the raw request-target spelling, so they cannot attest the same raw-path defense without host-specific validation. `context.signal` follows the signal of the request Hono received, which depends on that runtime.
:::

## Pass a verified principal

`mountHono(app, arc, native)` accepts a callback returning trusted native context. On Node, `secure` comes from the TLS socket; a proxy's `secure` and `authority`, and a host-verified `principal`, still require a trusted callback. See [Native principal](native-principal.md).

## Observable queries over WebSockets

Call `mountHonoWebSockets(app, arc.server, native?)` after `mountHono` and inject it into the Node listener. See [WebSockets](websockets.md#hono).

## Related

- [Host adapters](index.md)
- [Express](express.md) and [Fastify](fastify.md)

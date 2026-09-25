---
title: Fastify
description: Mount an Arc application in Fastify 5 as an encapsulated plugin, and account for Fastify's body limit and lazy plugin loading.
---

`@cratis/arc.fastify` registers an encapsulated plugin that owns Arc's routes in a Fastify 5 application. Your own parsers, hooks, and routes stay as they are.

## Mount the application

```typescript title="server.ts"
import Fastify from 'fastify';
import cratisArc from '@cratis/arc.fastify';
import { arc } from './arc.js';

const app = Fastify();
await app.register(cratisArc, { arc });
app.get('/health', async () => 'ok');
await app.listen({ port: 3000, host: '127.0.0.1' });

process.once('SIGTERM', () => {
    void app.close().then(() => arc.dispose());
});
```

`arc` is the built application from [Host adapters](index.md#before-you-start).

Fastify loads plugins lazily, so Arc's routes exist once the application is ready: after `listen`, `ready`, or the first `inject`. Do not register your own routes on Arc's paths; Fastify rejects the duplicate when it loads the plugin.

## Bodies and methods

Inside the plugin, one catch-all content type parser hands every body to Arc as a raw buffer, whatever its content type, including vendor types such as `application/vnd.acme+json`. Arc decodes it as strict UTF-8 JSON, so invalid UTF-8 answers 400 `malformedRequest`. Your application's parsers are not changed.

Command and query routes are registered for GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD, and `QUERY`; the root `/.cratis` metadata, identity, and discovery routes are registered for the standard methods without `QUERY`. Arc answers methods it receives but does not accept with 405 and an `Allow` header. Other methods are left to Fastify's routing, often 404.

The handler dispatches only when the raw request path equals the route Fastify matched, on a fixed internal origin, so a crafted `Host` header cannot select a different operation. `context.signal` aborts when the client disconnects before the response finishes.

:::caution[Fastify's body limit applies first]
Fastify enforces its own `bodyLimit`, 1 MiB by default, before Arc reads the body. A larger body gets Fastify's 413 response, not an Arc result. To accept larger bodies, raise both `bodyLimit` and Arc's `maxBodyBytes`.
:::

## Pass a verified principal

`app.register(cratisArc, { arc, native })` accepts a callback returning trusted native context for each request. See [Native principal](native-principal.md).

## Observable queries over WebSockets

`app.register(cratisArc, { arc })` registers HTTP and observable upgrades together (`webSockets` defaults to `true`). Set `webSockets: false` to disable upgrades. A shared `@fastify/websocket` can be registered before or after Arc; both orders are covered by real upgrade checks. The plugin also supports a Fastify registration prefix, including one inherited from a parent plugin. See [WebSockets](websockets.md#fastify).

## Related

- [Host adapters](index.md)
- [Express](express.md) and [Hono](hono.md)

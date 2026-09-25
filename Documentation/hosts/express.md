---
title: Express
description: Mount an Arc application in Express 5 before body parsers, and know how the adapter matches paths and reports errors.
---

`@cratis/arc.express` adds one middleware to an Express 5 application. Arc answers its own routes; everything else goes to your routes and middleware.

## Mount the application

```typescript title="server.ts"
import express from 'express';
import { cratisArc } from '@cratis/arc.express';
import { arc } from './arc.js';

const app = express();
const middleware = cratisArc(arc);
app.use(middleware);
app.use(express.json());
app.get('/health', (_request, response) => { response.send('ok'); });
const listener = app.listen(3000, '127.0.0.1');
const disposeSockets = middleware.injectWebSocket(listener);

process.once('SIGTERM', () => {
    void (async () => {
        try {
            await disposeSockets();
            const closed = new Promise<void>((resolve, reject) =>
                listener.close(error => error ? reject(error) : resolve()));
            listener.closeAllConnections(); // Drain open SSE responses before awaiting close.
            await closed;
        } finally { await arc.dispose(); }
    })();
});
```

`arc` is the built application from [Host adapters](index.md#before-you-start). With the Tasks sample's artifacts, `POST /api/tasks/registration/register-task` now reaches Arc, and `GET /health` reaches your route.

:::caution[Mount Arc before body parsers]
Arc reads the raw request body itself. If `express.json()` or another body parser runs first, it consumes the body, and Arc answers every command with 400 `malformedRequest`. Install `cratisArc(arc)` before you add body parsers, as in the example.
:::

## How requests are matched

The middleware compares the raw request path, before any normalization, with Arc's registered routes. Only an exact match is handled by Arc. Every other request goes to `next()`, including spellings such as `//api/echo`, `/x/../api/echo`, or `/api/%2e%2e/api/echo` that would only match after normalization. The adapter builds the Fetch API request on a fixed internal origin and never uses the `Host` header for routing.

An unexpected error inside the adapter is passed to Express with `next(error)`. An unknown path gets Express's own 404, which carries no Arc correlation header.

`context.signal` aborts when the client disconnects before the response finishes.

## Pass a verified principal

`cratisArc(arc, native)` accepts a second argument: a callback returning trusted native context for each request. Use it with `nativePrincipal: true` to pass a user your Express session or JWT middleware already verified. See [Native principal](native-principal.md).

## Observable queries over WebSockets

Express HTTP middleware does not run on Node `upgrade` requests. Attach WebSockets to the listener with `cratisArc(arc).injectWebSocket(listener, native?)`; the middleware cannot see upgrades. See [WebSockets](websockets.md#express).

## Related

- [Host adapters](index.md)
- [Fastify](fastify.md) and [Hono](hono.md)

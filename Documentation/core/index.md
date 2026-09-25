---
title: Arc.Core and the standalone Node host
description: Run an Arc application on Node's own HTTP server, own the listener yourself, and shut it down without losing in-flight work.
---

Not every service needs a web framework. A worker that exposes a few commands, or a small application that serves its own frontend, would otherwise pull in Express only to listen on a port and shut down cleanly.

`@cratis/arc.core` is the whole Arc application model: the command and query pipelines, validation, authorization, services, and the result envelope. It also carries a small Node host, so an application can serve its routes, and a built frontend, without Express, Fastify, or Hono. When you do use one of those frameworks, the same application mounts in it unchanged; see [Host adapters](../hosts/index.md).

:::note[Source preview]
`@cratis/arc.core` is not published to npm. Install a tarball packed from a clone of this repository, or use it inside the clone with the `workspace:^` protocol, as `Samples/Tasks/package.json` does. [Create an application](../getting-started/create-an-application.md) shows both paths.
:::

## Run a built application

`ArcApplication` wraps the `ArcServer` that the [application builder](getting-started.md) creates, and owns a standalone listener when you ask it to:

```typescript title="main.ts"
import { ArcApplication } from '@cratis/arc.core';
import { Tasks } from './Features/Tasks/Tasks.js';
import { metadata } from './Features/generatedMetadata.js';

const builder = ArcApplication.createBuilder();
builder.useGeneratedMetadata(metadata);
builder.services.addSingleton(Tasks);
await builder.discover(new URL('./Features/', import.meta.url));
export const app = await builder.build();
await app.run({ port: Number(process.env.PORT ?? 3000) });
```

This is the [Tasks sample entry point](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/main.ts). `app.run()` starts the listener and waits until SIGINT, SIGTERM, or `app.stop()`, then closes the listener and disposes the application. Its signal handlers are removed when it returns.

| Method | Behavior |
| --- | --- |
| `app.run(options?)` | Start, then wait for a signal or `stop()`; closes gracefully |
| `app.start(options?)` | Start listening and return; the caller decides when to stop |
| `app.stop()` | Close the listener, then dispose the server and its singleton services |
| `app.dispose()` | Same as `stop()`, whether or not a listener was started |
| `app.server` | The `ArcServer`, for direct calls, adapters, and introspection |

A stopped or disposed application cannot start again.

## Listener options

`run()` and `start()` accept the same options:

| Option | Default | Effect |
| --- | --- | --- |
| `port` | `3000` | TCP port; `0` picks an ephemeral port |
| `host` | `'127.0.0.1'` | Interface to bind. The default is loopback, not every interface |
| `https` | None | Node `https` server options, such as `{ key, cert }` |
| `pathBase` | None | A path prefix removed before Arc dispatch and static-file lookup |
| `staticFiles` | None | Serve a public directory; see [Static files](static-files.md) |
| `fallback` | None | SPA navigation fallback file inside `staticFiles.root` |
| `native` | None | A trusted callback returning a host-verified principal or authority for each request |

`pathBase` is matched case-insensitively and must be a segment-delimited path with no trailing slash. Unlike .NET's `UsePathBase`, this host also moves static files under the base; introspection route values and the OpenAPI document are not rewritten to include it.

## Host a low-level server

If you build an `ArcServer` directly from low-level definitions, `runArc(server, options)` takes the same options and returns `{ server, close }`:

```typescript title="server.ts"
import { ArcServer, defineCommand, runArc } from '@cratis/arc.core';
import { z } from 'zod';

const echo = defineCommand({
    name: 'Echo',
    schema: z.object({ value: z.string() }),
    handle: ({ value }) => value
});
const arc = new ArcServer({ commands: [echo] });
const host = await runArc(arc, { port: 3000, host: '127.0.0.1' });

process.once('SIGINT', () => {
    void host.close().then(() => arc.dispose());
});
```

`curl -X POST http://127.0.0.1:3000/api/echo -d '{"value":"hello"}'` answers with `"response":"hello"`. `runArc` never disposes the server; close the host first, then dispose Arc, as above.

## Shut down without dropping work

`close({ timeoutMs })` stops accepting HTTP connections first, closes Arc WebSockets, ends live server-sent-event streams (including ones that finish opening during shutdown), and waits up to 30 seconds by default for ordinary requests and WebSockets to drain. At the deadline it closes the remaining connections and rejects if shutdown is incomplete. WebSocket cleanup has its own `query.observableShutdownTimeoutMs` bound in [configuration](../configuration/index.md); an earlier host deadline can reject before that cleanup finishes.

## Bring your own Node server

When you already own a `node:http` server, use `createArcNodeHandler` as its request handler. A request handler cannot see WebSocket upgrades, so attach those explicitly on the same listener:

```typescript title="server.ts"
import { createServer } from 'node:http';
import { createArcNodeHandler } from '@cratis/arc.core';
import { attachNodeWebSockets } from '@cratis/arc.core/hosting';
import { app } from './app.js';

const listener = createServer(createArcNodeHandler(app.server));
const closeSockets = attachNodeWebSockets(listener, app.server);
listener.listen(3000, '127.0.0.1');

process.once('SIGTERM', async () => {
    await closeSockets();
    await new Promise<void>(resolve => listener.close(() => resolve()));
    await app.dispose();
});
```

Here `app` is a built `ArcApplication` from your own module. With a path base, pass it as the fourth `attachNodeWebSockets` argument; a trusted native resolver goes third. `createArcNodeHandler` does not manage listener errors, server-sent-event shutdown, or connection draining; you own those on your server. `runArc` and `app.run()` already own upgrades on their listener, so do not attach a second bridge there.

## Security defaults

- Arc enforces `hosting.maxBodyBytes` (1 MiB by default) on raw command and `QUERY` bodies, including chunked input, and aborts `context.signal` when the client disconnects.
- For a host-authenticated caller, set `nativePrincipal: true` and pass a `native(request)` callback that returns `{ principal }` after your host has verified the request. The callback applies to HTTP and WebSocket requests. Never derive the principal or `authority` from request or forwarded headers. See [Native principal](../hosts/native-principal.md).
- Cookie security is taken from the actual TLS socket, not from headers.

## Related

- [Build an application](getting-started.md)
- [Endpoint mapping](endpoint-mapping.md)
- [Static files and SPA fallback](static-files.md)
- [Host adapters](../hosts/index.md) if your application already uses a web framework

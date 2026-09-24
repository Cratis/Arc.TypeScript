---
title: Host Arc directly in Node.js
description: Serve Arc routes, public assets, and SPA navigation without Express, Fastify, or Hono.
---

Use the standalone Node host when you want Arc routes and a built frontend on the same port without a web framework. This source-preview package is not published to npm.

## Prerequisites

Use Node.js 22 or later and an ES module package in this repository's workspace. Run `yarn install && yarn build` first. Install Zod 4; use the `workspace:^` dependency for `@cratis/arc.server` and `@cratis/arc.server.node` until publication. Place a public `index.html` in a `public` directory. Do not place credentials or private uploads there.

## Start the host

Save this as `server.ts` and run it in the workspace with `node server.ts` on Node.js 26 (which strips types by default), or compile it with TypeScript and run the emitted JavaScript with Node.js 22 or later.

```typescript title="server.ts"
import { ArcServer, defineCommand } from '@cratis/arc.server';
import { runArc } from '@cratis/arc.server.node';
import { z } from 'zod';

const echo = defineCommand({
    name: 'Echo',
    schema: z.object({ value: z.string() }),
    handle: ({ value }) => value
});
const arc = new ArcServer({ commands: [echo] });
const host = await runArc(arc, {
    port: 3000,
    host: '127.0.0.1',
    pathBase: '/app',
    staticFiles: { root: 'public', defaultDocument: 'index.html' },
    fallback: 'index.html'
});

process.once('SIGINT', () => {
    void host.close().then(() => arc.dispose());
});
```

Try `curl -X POST http://127.0.0.1:3000/app/api/echo -d '{"value":"hello"}'`. The response has `"response":"hello"`. `GET /app/` serves `public/index.html`; `GET /app/dashboard` with `Accept: text/html` serves the same file. Requests outside `/app` return 404. The `pathBase` is removed before Arc dispatch and asset lookup, is matched case-insensitively, and must be a segment-delimited path with no trailing slash. Unlike .NET's `UsePathBase`, this host also moves static assets under the base; Arc's introspection route values and OpenAPI document are not rewritten to include it.

If you already own a Node HTTP server, use `createServer(createArcNodeHandler(arc, options))` instead. The handler does not listen or own your listener. `runArc` listens on loopback port 3000 by default, accepts `port: 0` for ephemeral ports and `https: { key, cert }` for a Node HTTPS server, and returns `{ server, close }`. Attach a future upgrade handler to `host.server` yourself; this package does **not** implement WebSocket. `close({ timeoutMs?: number })` stops accepting connections, destroys live SSE streams (including ones that finish opening during shutdown), and gives ordinary requests up to 30 seconds to drain by default. At the timeout it closes all remaining HTTP connections. It never calls `arc.dispose()`; close Arc yourself afterward, as above. The standalone `createArcNodeHandler` does not manage listener errors, SSE shutdown, or connection draining: the caller must own those on its Node server.

## Routing and security

Arc endpoints win over assets, even on the wrong HTTP method (Arc returns 405). Requests using a non-canonical spelling (percent escapes or repeated slashes) return 404. Endpoint paths with different case return 404; API-prefix and `/.cratis` paths are reserved case-insensitively before static lookup and fallback. Assets come next, then the optional HTML fallback, then plain-text 404 `Not Found`. Public assets are served only for GET/HEAD; directory requests use `index.html` by default, redirecting directory URLs without a trailing slash with 301. The default document and SPA fallback send `Cache-Control: no-cache`; static responses and 404s send `X-Content-Type-Options: nosniff`.

The host streams opened files up to their measured length, sets content types for common web formats (extend or override with `staticFiles.contentTypes` keyed by extension), and handles `If-None-Match` lists, weak ETags and `*` with 304. `If-None-Match` takes precedence over `If-Modified-Since`. Range requests receive the full 200 response with `Accept-Ranges: none`; media seeking is not supported. XML and SVG remain active same-origin content: only place trusted assets in the public root. The host rejects traversal, dotfiles, NUL bytes, backslashes, Windows alternate data streams and device names, and symlinks escaping the resolved root or pointing at a dotfile. Symlinks to ordinary files inside the root are allowed. To expose a specific `/.well-known/` file, list its relative name (for example, `.well-known/security.txt`) in `staticFiles.wellKnown`; other dotpaths remain blocked. Set `staticFiles.root` to your built frontend directory, resolved relative to the working directory; `runArc` fails to start if it is missing or the platform lacks `O_NOFOLLOW`. No directory is served unless configured.

Fallback requires `staticFiles`; its file path is relative to that root. It only answers GET/HEAD requests whose `Accept` includes `text/html`, for extensionless paths outside Arc's configured API prefix and `/.cratis`. An unknown API route never returns your SPA shell. Without a prefix, disable fallback if you need to reserve unknown root-level API paths. Neither static assets nor fallback run Arc authentication or tenancy; protect private files through authorized operations, not the public directory.

For a host-authenticated caller, set `nativePrincipal: true` on `ArcServer` and pass a `native(request)` callback that returns `{ principal }` after your host authenticates the socket. Never derive that principal or `authority` from request or forwarded headers. TLS cookie security is determined from the actual Node TLS socket. Arc enforces `maxBodyBytes` (1 MiB by default) on raw command and `QUERY` bodies, including chunked input, and cancels `context.signal` on client disconnect. Direct observable-query SSE responses stream through the host; [Stream an observable query](observable-queries.md) shows how to define a source and subscribe. WebSockets and multiplexed hubs are not available.

See [Host Arc in Express, Fastify, or Hono](host-integration.md) if your application already uses a web framework, and the [capability reference](../reference/capabilities.md) for the current limits.

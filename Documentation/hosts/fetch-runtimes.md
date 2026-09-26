---
title: Fetch API runtimes
description: Serve Arc commands, queries, and SSE from a Next.js Node.js route handler or another Node-compatible host without an Arc-owned listener.
---

You can handle Arc requests without an Arc-owned listener. Import the **source-preview** `@cratis/arc.core/fetch` entry, register artifacts explicitly, and hand the resulting `app.fetch` to your host. The package is not published to npm; install a tarball packed from a built clone, as [Create an application](../getting-started/create-an-application.md) shows, or use it inside the clone's workspace. **Arc targets Node-compatible servers:** Chronicle uses gRPC, MongoDB uses TCP, and live queries rely on long-lived SSE/WebSocket connections. Next.js App Router on its **Node.js** runtime is verified locally. Bun has a smoke check, not a supported deployment guarantee. Cloudflare Workers and Next.js Edge are **not supported** hosts for the full framework or these integrations.

## Build the application once

The Fetch entry has the same command/query pipelines as Node, but does not load configuration files or discover files. Use `builder.add(...)` or `builder.useGeneratedMetadata(metadata)` followed by `add(...)`. With no generated metadata, bind method parameters explicitly using the [model-bound APIs](../commands/model-bound/index.md).

```typescript title="Ping.ts"
import { command } from '@cratis/arc.core/fetch';

/** A minimal command served by the Fetch host. */
@command()
export class Ping {
    handle(): string { return 'pong'; }
}
```

```typescript title="Status.ts"
import { query, readModel } from '@cratis/arc.core/fetch';

/** A read model with one snapshot query. */
@readModel()
export class Status {
    @query()
    static all(): string[] { return ['ready']; }
}
```

```typescript title="arc.ts"
import { ArcApplication } from '@cratis/arc.core/fetch';
import { Ping } from './Ping.js';
import { Status } from './Status.js';

const builder = ArcApplication.createBuilder();
builder.add(Ping, Status);
export const app = await builder.build();
```

`POST /api/ping` with a JSON `{}` body returns `response: "pong"`; `GET /api/all` returns `data: ["ready"]`. The [Fetch scenario](https://github.com/Cratis/Arc.TypeScript/blob/main/scripts/fetch-runtime-scenario.mjs) exercises commands, validation, authorization, GET and `QUERY`, tenant and correlation headers, observable snapshots, direct and hub SSE, client request abort, and fall-through. Use your host's build tool to compile decorators and bundle dependencies. A neutral esbuild bundle externalizes **only** `node:async_hooks` (for `AsyncLocalStorage`); it imports no `node:fs`, `node:crypto`, `ws`, or other Node modules from the Fetch entry. The HTTP checks use built workspace `dist`, not a published tarball.

### Bun

```typescript title="server.ts"
import { app } from './arc.js';

Bun.serve({ port: 3000, fetch: (request: Request) => app.fetch(request) });
```

Stop the Bun server before calling `await app.dispose()` in your shutdown hook. `yarn check:fetch:bun` runs the shared scenario through `Bun.serve` on Bun 1.3.10. This is an optional smoke check only: Chronicle gRPC, MongoDB, production deployment, and lifecycle under load are unverified.

### Deno

```typescript title="server.ts"
import { app } from './arc.js';

Deno.serve({ hostname: '127.0.0.1', port: 3000 }, (request: Request) => app.fetch(request));
```

This hosting call requires Deno network permission. Deno 2.9.7 previously passed the smaller command, query, direct and hub SSE scenario; the expanded scenario and `Deno.serve` listener have not been rerun there. This is not a full Arc deployment target verification.

### Next.js route handler

Pin the Node.js runtime. The `app/api/[...arc]/route.ts` catch-all handles `/api/*` commands and queries; Arc's SSE hub lives at `/.cratis/*`, so provide another route for it (or rewrite that path into a Node-compatible handler). Build and share the application at module scope, not per request.

```typescript title="app/api/[...arc]/route.ts"
import { app } from '../../../arc.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request): Promise<Response> => app.fetch(request);
export const POST = (request: Request): Promise<Response> => app.fetch(request);
```

```typescript title="app/[...arc]/route.ts"
import { app } from '../../arc.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request): Promise<Response> => app.fetch(request);
export const POST = (request: Request): Promise<Response> => app.fetch(request);
```

The second catch-all also captures unrelated top-level paths; use `app.handle(request)` and your own fall-through where needed. `yarn check:fetch:next` runs these routes under Next.js 15.5.14 `next dev` on Node.js 26.8.1. It checks commands, validation, authorization, GET, SSE and hub streaming, client abort, tenant and correlation headers, and 404. Next.js rejects the nonstandard HTTP `QUERY` method with **400 before the route handler**; use GET instead. Production deployment, proxy buffering, WebSocket upgrades, and Chronicle/MongoDB integrations are **not verified**. Next.js Edge is not supported: `node:async_hooks` and the full framework's gRPC/TCP and long-lived streams are outside the Edge target.

## Boundaries and verification

The Fetch entry cannot perform file discovery or load configuration files, start a Node listener, serve static files, or upgrade WebSockets. Calling `discover()` on its builder fails rather than importing files. Use `@cratis/arc.core` unchanged on Node for those features. Both entries share the core pipelines; Chronicle and storage integrations require their own host-specific verification. The application does not own the host listener: close that listener before `await app.dispose()`. A Fetch host is responsible for trusted principal metadata, ingress limits, and canceling long-lived streams when clients disconnect.

`yarn check:fetch` bundles the compiled **package export** on esbuild's neutral platform, allows only `node:async_hooks`, and runs the shared scenario inside a Node VM without `process` or `Buffer`. `yarn check:fetch:deno` runs the same scenario in Deno. `yarn check:fetch:bun` and `yarn check:fetch:next` bundle the same built entry and send real HTTP requests through `Bun.serve` or Next.js App Router respectively. The Next.js `QUERY` check pins the host's rejection instead of claiming Arc dispatch; all other scenario assertions are shared. Install optional host executables outside the workspace and set `BUN_BIN` / `NEXT_BIN` and `ARC_RUNTIME_SCRATCH` as needed. Missing executables return exit code 2 (not run). The runtime scripts use scratch workspace directories outside the repository checkout and remove generated files afterward.

The Fetch entry's `node:async_hooks` requirement is satisfied by Node.js, Bun, and Deno. It does not bring in Node filesystem, Node crypto, or Node streams; Fetch globals supply crypto and streams. Cloudflare Workers (even with `nodejs_compat`) are **not supported** for the framework: Chronicle gRPC, MongoDB TCP, and long-lived live-query connections are not verified or promised there. These local checks do not establish full compatibility for every optional integration.

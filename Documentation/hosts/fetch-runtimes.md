---
title: Fetch API runtimes
description: Serve Arc commands, queries, and SSE from Bun, Deno, Cloudflare Workers, or a Next.js route handler without a Node HTTP listener.
---

You can handle Arc requests without starting a Node server. Import the **source-preview** `@cratis/arc.core/fetch` entry, register artifacts explicitly, and hand the resulting `app.fetch` to your host. The package is not published to npm; install a tarball packed from a built clone, as [Create an application](../getting-started/create-an-application.md) shows, or use it inside the clone's workspace. Bun, Cloudflare Workers, and Next.js deployment have **not** been run end to end here; see [Verification](#boundaries-and-verification).

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

`POST /api/ping` with a JSON `{}` body returns `response: "pong"`; `GET /api/all` returns `data: ["ready"]`. The [Fetch scenario](https://github.com/Cratis/Arc.TypeScript/blob/main/scripts/fetch-runtime-scenario.mjs) runs these same pipeline shapes, including direct and hub SSE. Use your runtime's build tool to compile decorators and bundle dependencies. A neutral esbuild bundle externalizes **only** `node:async_hooks`; do not externalize `node:fs`, `node:crypto`, `ws`, or other Node modules.

### Bun

```typescript title="server.ts"
import { app } from './arc.js';

Bun.serve({ port: 3000, fetch: (request: Request) => app.fetch(request) });
```

Stop the Bun server before calling `await app.dispose()` in your shutdown hook. This example is source-checked, not run on Bun.

### Deno

```typescript title="server.ts"
import { app } from './arc.js';

Deno.serve({ hostname: '127.0.0.1', port: 3000 }, (request: Request) => app.fetch(request));
```

This hosting call requires Deno network permission. The neutral bundle's command, query, direct SSE, and authenticated multiplexed SSE routes were exercised in Deno; the `Deno.serve` listener itself was not part of that check.

### Cloudflare Workers

Enable `nodejs_compat` in your Worker configuration. `node:async_hooks` supplies `AsyncLocalStorage`; plain Workers without that compatibility flag are not a supported target for this entry.

```toml title="wrangler.toml"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
```

```typescript title="worker.ts"
import { app } from './arc.js';

export default { fetch: (request: Request): Promise<Response> => app.fetch(request) };
```

Create the application at module initialization as shown; do not build it on every request. Worker deployment, limits, and streaming behavior have not been tested here.

### Next.js route handler

Next.js route handlers run on the Node.js runtime by default; pin it explicitly. A catch-all route such as `app/[...arc]/route.ts` lets Next.js route the request before handing it to Arc. Keep unrelated routes outside the catch-all or use `app.handle(request)` for fall-through in your own router.

```typescript title="app/[...arc]/route.ts"
import { app } from '../../arc.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request): Promise<Response> => app.fetch(request);
export const POST = (request: Request): Promise<Response> => app.fetch(request);
```

This excerpt only handles GET and POST. Add Next.js exports for other HTTP methods you need; Next.js route handlers do not document the custom HTTP `QUERY` method. Do not assume that Next.js Edge runtime supports the `node:async_hooks` import from this entry. Next.js route integration and SSE streaming through its deployment providers remain unverified.

## Boundaries and verification

The Fetch entry cannot perform file discovery or load configuration files, start a Node listener, serve static files, or upgrade WebSockets. Calling `discover()` on its builder fails rather than importing files. Use `@cratis/arc.core` unchanged on Node for those features. Both entries share the core pipelines; Chronicle and storage integrations require their own host-specific verification. The application does not own the host listener: close that listener before `await app.dispose()`. A Fetch host is responsible for trusted principal metadata, ingress limits, and canceling long-lived streams when clients disconnect.

`yarn check:fetch` bundles the compiled **package export** on esbuild's neutral platform, allows only `node:async_hooks`, then runs a model-bound command, query, direct SSE, authenticated SSE hub and unknown path inside a Node VM without `process` or `Buffer`. `DENO_BIN=/path/to/deno yarn check:fetch:deno` bundles the same scenario and runs it in Deno. Locally, Deno 2.9.7 passed that check. Neither check stands in for a Cloudflare deployment, a Bun listener, or Next.js streaming validation.

The permitted import is based on each runtime's own documentation: [Bun Node API support](https://bun.com/docs/runtime/nodejs-apis), [Deno's `node:async_hooks` API](https://docs.deno.com/api/node/async_hooks/), [Cloudflare's AsyncLocalStorage support](https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/) (with `nodejs_compat`), and [Next.js route runtime settings](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config) (Node runtime). These platform docs establish API availability, not a passed Arc deployment on every host.

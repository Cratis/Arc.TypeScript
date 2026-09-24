---
title: Build and host an Arc application
---

An application builder collects model-bound artifacts before it creates an `ArcServer`. The [Tasks entry point](../../Samples/Tasks/main.ts) uses a dedicated discovery root so importing the bootstrap cannot re-enter a suspended top-level `await`:

```typescript
import { ArcApplication } from '@cratis/arc.core';
import { Tasks } from './Features/Tasks/Tasks.js';

const builder = ArcApplication.createBuilder({ development: true });
builder.services.addSingleton(Tasks);
await builder.discover(new URL('./Features/', import.meta.url));
export const app = await builder.build();
await app.run({ port: Number(process.env.PORT ?? 3000) });
```

`app.server` is the `ArcServer` for direct calls, introspection, and the existing HTTP adapters. The standalone `run()` host binds loopback port 3000 by default and waits until SIGINT, SIGTERM, or `app.stop()` gracefully closes the listener and disposes the app. For a non-blocking listener use `await app.start({ port: 3000 })`, then `await app.stop()` or `await app.dispose()` when the host shuts down. Do not start a disposed application again.

`discover(folderUrl, { rootNamespace? })` loads exported decorated classes below that folder in deterministic path order. It accepts emitted `.js` or loader-backed `.ts`, not a mix. It excludes `dist`, `node_modules`, `given`, `for_*`, `index.*`, and declaration files; it skips symbolic links. It refuses a folder containing the entry point or an imported bootstrap currently calling discovery, and reports a class discovered with conflicting namespaces. A folder rename changes derived routes. For bundled production applications, call `builder.add(RegisterTask, TaskItem)` instead and give artifacts stable `@command({ namespace: 'Tasks.Registration' })` / `@readModel({ namespace: 'Tasks.Listing' })` names as needed. If you rely on class names in routes, configure your bundler to preserve them (`keepNames` in esbuild), or set explicit names and paths.

`createBuilder` accepts `ArcOptions` (the existing `ArcServerOptions` name remains exported). Set `generatedApis: { routePrefix: 'api', segmentsToSkipForRoute: 0, includeCommandNameInRoute: true, includeQueryNameInRoute: true }` to configure routes as in .NET. The flat `prefix`, `segmentsToSkip`, `includeCommandNameInRoute`, and `includeQueryNameInRoute` remain deprecated aliases; nested options take precedence. Both include-name options default to `true` and still include a name when omitting it would collide in a namespace. The `/.cratis/commands`, `/.cratis/queries`, and `/openapi.json` endpoints describe the built application.

If another framework owns the listener, pass the built app to `mountExpress(expressApp, app)`, `mountFastify(fastifyApp, app)`, or `mountHono(honoApp, app)` instead of calling `app.run()`. The old overloads accepting `ArcServer` remain. Read [Host integration](host-integration.md) for WebSocket upgrades and trusted native context; passing an application to an adapter does not make the adapter own its shutdown.

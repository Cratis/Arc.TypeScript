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

`app.server` is the `ArcServer` for direct calls, introspection, and the existing HTTP adapters. The standalone `run()` host binds loopback port 3000 by default. `await app.stop()` closes that listener and disposes owned services; `await app.dispose()` does the same. Do not start a disposed application again.

`discover(folderUrl, { rootNamespace? })` loads exported decorated classes below that folder in deterministic path order. It accepts emitted `.js` or loader-backed `.ts`, not a mix. It excludes `dist`, `node_modules`, `given`, `for_*`, `index.*`, and declaration files; it skips symbolic links. It refuses the bootstrap folder and reports a class discovered with conflicting namespaces. A folder rename changes derived routes. For bundled production applications, call `builder.add(RegisterTask, TaskItem)` instead and give artifacts stable `@command({ namespace: 'Tasks.Registration' })` / `@readModel({ namespace: 'Tasks.Listing' })` names as needed.

`createBuilder` accepts `ArcOptions` (the existing `ArcServerOptions` name remains exported). `prefix`, `segmentsToSkip`, `includeCommandNameInRoute`, and `includeQueryNameInRoute` mirror .NET route choices; the two include-name options default to `true` and still include a name when omitting it would collide in a namespace. The `/.cratis/commands`, `/.cratis/queries`, and `/openapi.json` endpoints describe the built application.

If another framework owns the listener, pass the built app to `mountExpress(expressApp, app)`, `mountFastify(fastifyApp, app)`, or `mountHono(honoApp, app)` instead of calling `app.run()`. The old overloads accepting `ArcServer` remain. Read [Host integration](host-integration.md) for WebSocket upgrades and trusted native context; passing an application to an adapter does not make the adapter own its shutdown.

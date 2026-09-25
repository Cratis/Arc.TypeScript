---
title: Build an Arc application
description: Collect model-bound artifacts with the application builder, discover them from a folder or add them explicitly, and run or mount the built application.
---

An application builder collects your commands, read models, validators, and services, checks that they fit together, and creates the `ArcServer` that every host uses. You describe the application once; the host is a separate choice.

## Create, fill, and build

The [Tasks entry point](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/main.ts) uses a dedicated discovery folder:

```typescript title="main.ts"
import { ArcApplication } from '@cratis/arc.core';
import { Tasks } from './Features/Tasks/Tasks.js';

const builder = ArcApplication.createBuilder();
builder.services.addSingleton(Tasks);
await builder.discover(new URL('./Features/', import.meta.url));
export const app = await builder.build();
await app.run({ port: Number(process.env.PORT ?? 3000) });
```

The Tasks sample sets `Development` in `Samples/Tasks/appsettings.json`; run the workspace command from its package directory (Yarn does this). `createBuilder` accepts the [configuration options](../configuration/index.md) (`ArcOptions`). `build()` returns an `ArcApplication`, and `app.server` is its `ArcServer`. This TypeScript setup corresponds to C#'s standalone `ArcApplication.CreateBuilder(args)`, `builder.AddCratisArc()`, `builder.Build()`, `app.UseCratisArc()`, `app.RunAsync()`. On Node, `app.run()` performs the standalone host step. For an Arc + Chronicle comparison, see [Add event sourcing](../chronicle/add-event-sourcing.md).

Before a listener opens, `build()` checks the declared graph: missing service registrations, dependency cycles, singletons that capture shorter-lived services, and decorators placed where they have no effect. It never runs a service factory to do this.

## Discover artifacts from a folder

`discover(folderUrl, { rootNamespace? })` imports every exported decorated class below the folder, in deterministic path order.

- It accepts emitted `.js` files or loader-backed `.ts` files, not a mix of both.
- It skips `dist`, `node_modules`, `given`, `for_*`, `index.*`, declaration files, and symbolic links.
- It refuses a folder that contains the entry point, or an imported bootstrap that is itself calling discovery. Keep artifacts in a dedicated folder.
- It derives each artifact's namespace from its path below the folder, and reports a class discovered under two different namespaces.

A folder rename changes the derived routes. [Endpoint mapping](endpoint-mapping.md) shows how to pin a route.

## Add artifacts explicitly

Bundled production builds often cannot import a folder at runtime. Pass the classes instead:

```typescript
builder.add(RegisterTask, RegisterTaskValidator, TaskItem);
```

`add()` rejects a class without an Arc decorator. Give explicitly added artifacts stable namespaces with `@command({ namespace: 'Tasks.Registration' })` and `@readModel({ namespace: 'Tasks.Listing' })`. If you rely on class names in routes, configure the bundler to keep them (`keepNames` in esbuild), or set explicit namespaces and paths.

Besides commands, read models, and validators, `add()` and `discover()` recognize classes marked `@queryRenderer()`, `@readModelInterceptor()`, `@commandResponseValueHandler()`, `@identityDetailsProvider()`, and the lifetime decorators `@singleton()`, `@scoped()`, and `@transient()`.

## Register extension points

The builder also registers services that change pipeline behavior:

| Builder method | Registers |
| --- | --- |
| `services.addSingleton / addScoped / addTransient` | An application service; see [Dependency injection](../dependency-injection.md) |
| `addAuthorizationPolicy(name, policy)` | A named policy; see [Authorization policies](authorization.md) |
| `addCommandResponseValueHandler(token)` | A handler for server-side return values; see [Response value handlers](../commands/response-value-handlers.md) |
| `addCommandKeyResolver(token)` | A rule that computes a command key; see [Command context](../commands/command-context.md) |
| `addCommandContextValuesProvider(token)` | Values attached to every command context |
| `addReadModelForCommandResolver(token)` | A source for `commandReadModel(...)` parameters |
| `addQueryRenderer(token)` | A renderer for provider-owned query results; see [Query renderers](../queries/renderers.md) |
| `addReadModelInterceptor(token)` | A read-model transform; see [Read-model interception](../queries/read-model-interception.md) |

After importing their packages, call `withMongoDB`, `withDrizzle`, or `withChronicle`. The old `add*` methods and standalone functions remain as deprecated aliases. The builder uses a `Symbol.for`-keyed extension registry rather than changing its prototype; importing an integration registers its install function even if the core is loaded twice. A missing integration fails at the call site. Configuration from `appsettings.json` is available to Chronicle and MongoDB, but model classes, clients, and authentication must be provided explicitly.

## Run it, or mount it

- `await app.run(...)` or `await app.start(...)` use the [standalone Node host](index.md).
- `expressApp.use(cratisArc(app))`, `await fastifyApp.register(cratisArc, { arc: app })`, and `honoApp.use(cratisArc(app))` hand the application to a web framework. Import `cratisArc` from the matching adapter package. The host keeps listener ownership; call `await app.dispose()` at shutdown. See [Host adapters](../hosts/index.md).
- `app.fetch(request)` returns an Arc response or 404 for foreign paths; `app.handle(request)` returns `null` for fall-through. These Fetch methods alone do not establish edge-runtime compatibility: the core still imports Node runtime modules.

A caller-owned `ServiceRegistry` passed in the options cannot be combined with builder service registrations.

## Related

- [Hosting overview](../overview.md)
- [Endpoint mapping](endpoint-mapping.md)
- [Decorator reference](../decorators.md)

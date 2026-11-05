---
title: Build an Arc application
description: Collect model-bound artifacts with the application builder, discover them from a folder or add them explicitly, and run or mount the built application.
---

You have a command, a read model, and the services they need. Before you expose them over HTTP, you need to collect them and check the wiring. The application builder does that once, creating the `ArcServer` you can run on its own or mount in a web framework. Choosing a host does not change your application artifacts.

Use an existing Arc project for these excerpts. If you are starting from an empty directory, follow [Create an application](../getting-started/create-an-application.md) for project setup first; the snippets here are not a standalone project.

## Create, fill, and build

The [Tasks entry point](../getting-started/index.md#see-what-started-the-server) shows how an existing Arc project supplies discovery, service registration, and generated metadata. To see what the builder itself needs, start with an artifact that has no injected parameters:

```typescript title="Status.ts"
import { field } from '@cratis/fundamentals';
import { query, readModel } from '@cratis/arc.core';

@readModel()
export class Status {
    @field(String) value = 'ready';

    @query()
    static current(): Status { return new Status(); }
}
```

`Status` declares a read model and a query that returns it. Since `current()` takes no arguments, it needs no parameter bindings. This example uses explicit registration: add the class to the builder, then build and run the application. Folder discovery, described below, is an alternative way to collect the same artifacts, not an additional wiring step:

```typescript title="main.ts"
import { ArcApplication } from '@cratis/arc.core';
import { Status } from './Status.js';

const builder = ArcApplication.createBuilder();
builder.add(Status);
export const app = await builder.build();
await app.run({ port: Number(process.env.PORT ?? 3000) });
```

`build()` returns an `ArcApplication`; `app.server` is the `ArcServer` inside it. `app.run()` starts the standalone Node listener, serving the query from the class you added. `createBuilder` accepts the [configuration options](../configuration/index.md) (`ArcOptions`).

The Tasks command and queries do take parameters. In that bootstrap, `useGeneratedMetadata(metadata)` installs the bindings that `arc-proxygenerator --metadata` extracted from the source, so `handle(tasks: Tasks)` and a bare `@query()` need no token lists. Call it before `discover()` or `add()`. Without it, the sample's artifacts would need explicit `@inject(...)` and `@query(...)` tokens, and `build()` rejects them as written. See [Generate artifact metadata](../proxy-generation/generated-artifact-metadata.md).

The Tasks sample's `Samples/Tasks/appsettings.json` enables fixture providers with `Cratis:Arc:Development`; it does not select the runtime environment. The Yarn `start` script separately sets `DOTNET_ENVIRONMENT=Development`. Run the workspace command from the sample's package directory (Yarn does this) so it reads that configuration file.

Before a listener opens, `build()` checks the declared graph: missing service registrations, dependency cycles, singletons that capture shorter-lived services, and decorators placed where they have no effect. It never runs a service factory to do this. A wiring error stops the build rather than waiting for the first request.

If you know Arc on .NET, this setup corresponds to standalone `ArcApplication.CreateBuilder(args)`, `builder.AddCratisArc()`, `builder.Build()`, `app.UseCratisArc()`, `app.RunAsync()`. On Node, `app.run()` performs the standalone host step. For an Arc + Chronicle comparison, see [Add event sourcing](../chronicle/add-event-sourcing.md).

## Discover artifacts from a folder

Choose discovery when your artifacts live in a dedicated folder and you want to collect them without listing every class. `discover(folderUrl, { rootNamespace? })` imports every exported decorated class below that folder, in deterministic path order.

- It accepts emitted `.js` files or loader-backed `.ts` files, not a mix of both.
- It skips `dist`, `node_modules`, `given`, `for_*`, `index.*`, declaration files, symbolic links, co-located `*.proxy.ts` / `*.proxy.js` files, and React `.tsx` files.
- It refuses a folder that contains the entry point, or an imported bootstrap that is itself calling discovery. Keep artifacts in a dedicated folder.
- It derives each artifact's namespace from its path below the folder, and reports a class discovered under two different namespaces.

A folder rename changes the derived routes. [Endpoint mapping](endpoint-mapping.md) shows how to pin a route.

## Add artifacts explicitly

Choose explicit registration instead of discovery when you want to list the artifacts yourself. Bundled production builds often cannot import a folder at runtime, so pass the classes instead:

```typescript
builder.add(RegisterTask, RegisterTaskValidator, TaskItem);
```

`add()` rejects a class without an Arc decorator. Give explicitly added artifacts stable namespaces with `@command({ namespace: 'Tasks.Registration' })` and `@readModel({ namespace: 'Tasks.Listing' })`. If you rely on class names in routes, configure the bundler to keep them (`keepNames` in esbuild), or set explicit namespaces and paths.

Besides commands, read models, and validators, `add()` and `discover()` recognize classes marked `@queryRenderer()`, `@readModelInterceptor()`, `@commandResponseValueHandler()`, `@identityDetailsProvider()`, and the lifetime decorators `@singleton()`, `@scoped()`, and `@transient()`.

## Register extension points

Keep application service registration and pipeline extensions on the same builder, before `build()`. Use these methods when you need to change how a command or query runs:

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

For a storage integration, import its package before calling `builder.withMongoDB(...)`, `builder.withDrizzle(...)`, or `builder.withChronicle(...)`: the import adds the method to the builder. Each package also exports a function form, `withX(builder, options)`. Configuration from `appsettings.json` is available to Chronicle and MongoDB, but you still provide model classes, clients, and authentication explicitly.

## Run it, or mount it

With the application built, choose who owns the listener and its shutdown:

- `await app.run(...)` or `await app.start(...)` use the [standalone Node host](index.md).
- `expressApp.use(cratisArc(app))`, `await fastifyApp.register(cratisArc, { arc: app })`, and `honoApp.use(cratisArc(app))` hand the application to a web framework. Import `cratisArc` from the matching adapter package. The host keeps listener ownership; call `await app.dispose()` at shutdown. See [Host adapters](../hosts/index.md).
- `app.fetch(request)` returns an Arc response or 404 for foreign paths; `app.handle(request)` returns `null` for fall-through. These Fetch methods alone do not establish edge-runtime compatibility: the core still imports Node runtime modules.

A caller-owned `ServiceRegistry` passed in the options cannot be combined with builder service registrations.

## Related

- [Hosting overview](../overview.md)
- [Endpoint mapping](endpoint-mapping.md)
- [Decorator reference](../decorators.md)

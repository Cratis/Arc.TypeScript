---
title: Register model-bound services
description: Register services with a lifetime, inject them into handlers, queries, and validators, and let the build check the dependency graph.
---

The [Tasks sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/main.ts) gives its command and queries one shared, in-memory repository:

```typescript
const builder = ArcApplication.createBuilder({ development: true });
builder.useGeneratedMetadata(metadata);
builder.services.addSingleton(Tasks);
await builder.discover(new URL('./Features/', import.meta.url));
const app = await builder.build();
```

This excerpt assumes `Tasks` and imports of `ArcApplication` from `@cratis/arc.core` and `metadata` from the [Tasks generated module](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/generatedMetadata.ts). `addSingleton(Tasks)` self-binds the class. `addScoped(Tasks)` makes one instance per execution scope; `addTransient(Tasks)` creates a fresh instance per resolution. You can instead register an abstract class token with a concrete implementation, or register a `serviceToken<T>` and factory. Class constructors and `serviceToken` values are both valid tokens. `builder.build()` checks declared artifact dependencies for missing registrations, cycles, and singleton-to-shorter-lifetime captures before opening a listener; it never executes a service factory to preflight it.

With [generated artifact metadata](generated-artifact-metadata.md), write `handle(tasks: Tasks)` and `@query() static taskById(id: TaskId, tasks: Tasks)` without repeating runtime tokens. For a project without generation, put `@inject(Tasks)` on the handler and use ordered `argument('id', TaskId), service(Tasks)` query descriptors. Arc resolves services within the HTTP or direct-call execution scope. For constructor dependencies on a registered class, use `@injectable(OtherService)` or `static inject = [OtherService] as const`. You can also decorate a discovered service class with `@singleton()`, `@scoped()`, or `@transient()` to register itself; without one of those, add it explicitly to `builder.services`.

Standard decorator signatures also check `@inject(...)` and `@query(...)` parameter types. TypeScript error TS1241 (“Unable to resolve signature of method decorator”) usually means the declared method parameters do not match the decorator: check the service token order and include the `provide()` result as the first `handle()` argument. A wrongly placed decorator can also fail at `builder.build()` rather than silently doing nothing.

There are two tested decorator modes:

- **Standard decorators (recommended in this sample):** generate and install a metadata module from the TypeScript project. The source analyzer supplies concrete class tokens and argument names; TypeScript does not reflect erased types at runtime. Explicit tokens override generated bindings.
- **Legacy `experimentalDecorators` with `emitDecoratorMetadata`:** a decorated `@inject()` method, a decorated `@query()` method, or a decorated `@injectable()` class can infer **class-valued** parameters. The compilation transform must emit `design:paramtypes`. Interfaces, `Object`, missing metadata, and erased generics cannot be inferred; registration fails with a diagnostic naming the member. An explicit token list always wins.

Interfaces and erased generic parameters still require an explicit runtime token. The analyzer reports unsupported implicit bindings with a source location. A singleton factory never receives request identity. Dispose the built app with `await app.dispose()` to stop its listener and dispose the registry; host adapters take `app` but their host still owns its own listener and shutdown. A caller-owned `ServiceRegistry` cannot be combined with builder registrations. For the underlying low-level scope and disposal contract, see [Compose services and test pipelines](services-and-testing.md).

---
title: Register model-bound services
---

The [Tasks sample](../../Samples/Tasks/main.ts) gives its command and queries one shared, in-memory repository:

```typescript
const builder = ArcApplication.createBuilder({ development: true });
builder.services.addSingleton(Tasks);
await builder.discover(new URL('./Features/', import.meta.url));
const app = await builder.build();
```

This excerpt assumes the `Tasks` class and an import of `ArcApplication` from `@cratis/arc.core`. `addSingleton(Tasks)` self-binds the class. `addScoped(Tasks)` makes one instance per execution scope; `addTransient(Tasks)` creates a fresh instance per resolution. You can instead register an abstract class token with a concrete implementation, or register a `serviceToken<T>` and factory. Class constructors and `serviceToken` values are both valid tokens. `builder.build()` checks declared artifact dependencies for missing registrations, cycles, and singleton-to-shorter-lifetime captures before opening a listener; it never executes a service factory to preflight it.

Put `@inject(Tasks)` on a command's `handle(tasks: Tasks)` and `service(Tasks)` in a query's ordered `@query(...)` parameter descriptors. Arc resolves services within the HTTP or direct-call execution scope. For constructor dependencies on a registered class, use `@injectable(OtherService)` or `static inject = [OtherService] as const`. You can also decorate a discovered service class with `@singleton()`, `@scoped()`, or `@transient()` to register itself; without one of those, add it explicitly to `builder.services`.

There are two tested decorator modes:

- **Standard decorators (recommended in this sample):** list tokens explicitly. A compiler cannot reflect erased TypeScript parameter types.
- **Legacy `experimentalDecorators` with `emitDecoratorMetadata`:** a decorated `@inject()` method, a decorated `@query()` method, or a decorated `@injectable()` class can infer **class-valued** parameters. The compilation transform must emit `design:paramtypes`. Interfaces, `Object`, missing metadata, and erased generics cannot be inferred; registration fails with a diagnostic naming the member. An explicit token list always wins.

A singleton factory never receives request identity. Dispose the built app with `await app.dispose()` to stop its listener and dispose the registry; host adapters take `app` but their host still owns its own listener and shutdown. A caller-owned `ServiceRegistry` cannot be combined with builder registrations. For the underlying low-level scope and disposal contract, see [Compose services and test pipelines](services-and-testing.md).

---
title: Dependency injection
description: Register services with a lifetime, inject them into commands, queries, and validators by class or token, and rely on the build to check the graph and on scopes to dispose what they create.
---

Handlers need repositories, clocks, and clients, and those need to be created once, per request, or every time, and cleaned up afterward. Arc has its own small service registry built for that: you register a class or a token with a lifetime, list what each method needs, and the build checks the whole graph before a listener opens.

Arc for TypeScript does not integrate with another dependency injection container.

## Register services

The [Tasks bootstrap](getting-started/index.md#see-what-started-the-server) registers `Tasks` as a singleton shared by its command and queries. It installs generated metadata before discovering the artifacts, then builds the application:

```typescript title="main.ts (excerpt)"
import { ArcApplication } from '@cratis/arc.core';
import { Tasks } from './Features/Tasks/Tasks.js';
const builder = ArcApplication.createBuilder();
builder.services.addSingleton(Tasks);
```

| Registration | Lifetime |
| --- | --- |
| `addSingleton(Tasks)` | One instance for the application |
| `addScoped(Tasks)` | One instance per execution scope: an HTTP request, a direct call, or an observable subscription |
| `addTransient(Tasks)` | A fresh instance per resolution |

Each method self-binds a class, or takes a second argument: a concrete class for an abstract class token, or a factory `(scope) => instance`. An abstract class is a good token because it exists at runtime; an interface does not. For a value with no class, create a token with `serviceToken<T>('name')`.

Instead of registering explicitly, decorate a discovered class with `@singleton()`, `@scoped()`, or `@transient()`. Without one of those, add it to `builder.services`.

## Inject services

| Where | How |
| --- | --- |
| Command `handle()` or `provide()` | Generated metadata, or `@inject(Tasks)` with one token per parameter in order |
| Query method | Generated metadata, or `service(Tasks)` in the ordered `@query(...)` descriptors |
| Class constructor | `@injectable(OtherService)` or `static inject = [OtherService] as const` |
| Validator constructor | The same as a class constructor |

`builder.build()` checks declared artifact dependencies for missing registrations, cycles, and singletons that capture scoped or transient services, before opening a listener. It never runs a service factory to do so.

## Decorator modes

Two decorator modes are tested:

- **Standard decorators**, used by the sample, need [generated artifact metadata](proxy-generation/generated-artifact-metadata.md) or explicit token lists. The compiler cannot reflect erased parameter types.
- **Legacy `experimentalDecorators` with `emitDecoratorMetadata`**: a decorated `@inject()` method, `@query()` method, or `@injectable()` class can infer **class-valued** parameters from `design:paramtypes`. Interfaces, `Object`, missing metadata, and erased generics cannot be inferred; registration fails with a diagnostic naming the member. An explicit token list always wins.

In standard mode, `@inject(...)` and `@query(...)` also type-check their parameters. TypeScript error TS1241 usually means the tokens and parameters do not match; see [Troubleshooting](troubleshooting.md#ts1241-unable-to-resolve-signature-of-method-decorator).

## Low-level services

Low-level definitions register services as `{ token, lifetime, factory }` in the `services` option, declare them with `handlerDependencies` or `validatorDependencies`, and resolve them with `currentServices()`:

```typescript
import { ArcServer, currentServices, defineCommand, serviceToken, ServiceLifetime, Severity } from '@cratis/arc.core';
import { z } from 'zod';

const journal = serviceToken<{ append(text: string): void; entries: string[] }>('journal');
let created = 0;
const server = new ArcServer({
    services: [{ token: journal, lifetime: ServiceLifetime.Scoped, factory: () => {
        created++;
        const entries: string[] = [];
        return { entries, append: (text: string) => { entries.push(text); } };
    } }],
    commands: [defineCommand({
        name: 'Write',
        schema: z.object({ text: z.string() }),
        handlerDependencies: [journal],
        handle: async ({ text }) => {
            const service = await currentServices().resolve(journal);
            service.append(text);
            return service.entries;
        }
    })]
});
const context = {
    correlationId: crypto.randomUUID(), principal: undefined, tenantId: 'acme',
    signal: new AbortController().signal, allowedSeverity: Severity.Warning
};
const validation = await server.validateCommand('Write', { text: 'hello' }, context);
const result = await server.executeCommand('Write', { text: 'hello' }, context);
console.log(validation.isSuccess, result.response, created); // true ['hello'] 1
await server.dispose();
```

The validation-only call checks that the journal is registered but never constructs it. `validatorDependencies` are preflighted **and constructed** before validators, including on `/validate`; `handlerDependencies` are preflighted, then constructed only after validation succeeds. A missing dependency reports reason `dependencyUnavailable`, not `rule`.

A factory declares its own `dependencies` for preflight and resolves them with its `resolver` argument; a scoped or transient factory also receives the execution context as its second argument. You can register a singleton `instance` instead of a factory; Arc does not dispose a caller-owned instance. Register each token once.

## Scopes and disposal

- Arc creates and disposes a scope for every HTTP request or direct call, including denied or failed executions.
- Scoped and transient instances created by factories belong to their scope. Arc calls `Symbol.asyncDispose` or `Symbol.dispose` once, in reverse creation order, even after an exception. A disposal failure turns a successful result into a failure. Disposal is not a rollback of external effects.
- Singletons belong to the registry and are disposed when you call `await app.dispose()` (or `await server.dispose()`). A singleton factory receives a frozen registry-lifetime context with only a `signal`, and never a request identity; do not capture request data in a singleton.
- A factory alias of an existing singleton or caller-owned instance does not take ownership. Returning an object owned by another scope fails with a service dependency error.
- If you pass your own `ServiceRegistry` in `services`, you own its disposal; the server does not dispose it. It cannot be combined with builder registrations.

Registry shutdown drains admitted work and pending singleton construction, then aborts the registry signal and disposes singletons. It rejects new executions and scopes. A singleton factory that fails poisons the registry and triggers the same shutdown. Cancellation is cooperative: factories and handlers must observe their signal. Do not await `registry.dispose()` from inside its own handler, factory, or disposer; it rejects to prevent a deadlock. Stop singleton background loops when the registry signal aborts, then join them in the singleton's disposer.

Nested commands and queries keep their causal dependency ancestry for cycle detection but get their own execution identity and scoped lifetime guard; the same scoped token in two independent nested scopes is not a cycle.

## Borrow a scope in a host integration

A trusted host integration can call `server.runInScope(scope, callback, { correlationId, signal })` to run construction and callbacks with `currentContext()` and `currentServices()` set. Create the scope with `server.services.createScope(context)` and dispose it yourself after all borrowed work settles; `runInScope` does not own it. The scope captures tenant, principal (including roles, claims, and extra fields), transport identity, severity, and cancellation authority at creation. A borrowed invocation may supply only a valid UUID correlation ID (normalized to lowercase) and an additional cancellation signal linked to the scope's signal. It rejects a signal already aborted before the invocation starts. Nested calls restore the prior context when they settle.

Principal fields are detached and recursively frozen for borrowed work. `Map`, `Set`, and `Date` values are cloned, but their mutating methods still work after `Object.freeze` and must not be changed by borrowed code. A principal that is a class instance is copied as plain data: its prototype methods, getters and private fields are not part of the snapshot. If a legacy principal cannot be cloned (for example, claims containing functions or symbols, nesting beyond the supported depth, or non-array roles), ordinary requests continue with the original principal, the scope still keeps its creation-time tenant and other context fields, and `runInScope` rejects the scope.

This is a trusted host API, **not an authorization mechanism** or a way to authenticate a principal. Use the normal command or query pipeline for authorization; do not expose scope creation or borrowed execution to untrusted callers.

## Related

- [Build an application](core/getting-started.md)
- [Testing](testing/index.md), where scenarios register fakes

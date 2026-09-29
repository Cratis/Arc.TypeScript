---
title: Activate reactors and reducers in Arc scopes (preview)
description: Opt in to constructing Chronicle reactors and reducers through Arc's service container, one scope per delivery, with the observation's tenant and correlation.
---

:::caution[Preview]
Scoped activation is off by default and its behavior can still change. Applications that do not opt in are unaffected.
:::

By default the Chronicle SDK creates reactors and reducers itself, so their constructors cannot take Arc services. With scoped activation, Arc resolves them from its container instead.

## Opt in

Set `activateArtifactsInScopes` on an Arc-owned connection:

```typescript title="main.ts (excerpt)"
builder.withChronicle({
    connectionString: 'chronicle://localhost:35000',
    eventStore: 'MyArcApp',
    activateArtifactsInScopes: true
});
```

Scoped activation requires `@cratis/chronicle` 6.17.0 or later. Older versions the peer range still allows either ignore the activator or cannot report per-event correlation and scope cleanup failures, so with the option set `withChronicle` fails with `activateArtifactsInScopes requires @cratis/chronicle 6.17.0 or later`. With the option off, older versions keep working.

Registration rejects the option together with `client`, because caller-owned clients are not supported yet.

With the option set, Chronicle-only artifacts that `discover(...)` found before `withChronicle` was called are registered with Chronicle too. Without it, registration is unchanged.

With the option set, building the application checks each reactor's and reducer's registration and its constructor dependencies, without constructing any of them. A missing service, a constructor Arc cannot bind (for example constructor parameters without `inject` tokens or decorator metadata), or a singleton artifact that depends on a scoped service fails the build, and the error names the artifact.

## What a delivery gets

For each delivery Chronicle makes to a reactor or reducer, Arc:

- rejects it unless it comes from the configured event store;
- creates a service scope and resolves the artifact from it, so constructor dependencies are shared by every event in the batch and not by the next batch;
- sets `currentContext()` for each handler: the tenant is the observation's namespace, the correlation is the handled event's correlation, there is no principal, the signal is cancelled when the application shuts down, and warnings are allowed;
- handles a replay notification in its own scope, with a newly generated correlation;
- disposes the scope after the batch and before Chronicle acknowledges it.

Commands a handler returns follow the rules in [Returning commands from a reactor](command-side-effects.md): they run in the observation's tenant with no principal, or with a system principal when the reactor uses `@executeCommandsAsSystem`. They do not receive the delivery's cancellation yet; each returned command gets its own signal, which shutdown does not abort.

### The tenant in a single-tenant application

The tenant is the observation's namespace as Chronicle reports it, so in an application without tenancy a handler sees `Default`, not an unset tenant. `Default` addresses the same data as an unset tenant: Chronicle maps both to the `Default` namespace, and the MongoDB and Drizzle integrations map it to the base database. Arc keeps `Default` rather than clearing it because those integrations require a tenant and fail without one, and because the commands a reactor returns already run with the namespace as their tenant, so a handler and its commands agree.

A registration you make yourself still wins. A reactor registered as a singleton is shared by all deliveries and is disposed with the application, not after each batch; it cannot depend on scoped services.

## Failures

- If constructing the artifact fails, Arc disposes the services it already created. When that cleanup also fails, the error combines both failures.
- If disposing the scope fails, the delivery fails, even when every handler succeeded. When a handler also failed, both errors are kept.

A failed delivery is retried. It is not rolled back: appended events, commands and other side effects that already ran stay done and can run again, so handlers must be idempotent.

## Shutdown

When the application shuts down, Arc stops accepting new deliveries, aborts `currentContext().signal` for running handlers, and waits for them to finish and dispose their scopes before it disposes services. Cancellation is cooperative: a handler that ignores the signal delays shutdown until it settles.

## Use the activator directly

`chronicleArtifactActivator(server, eventStore)` from `@cratis/arc.chronicle` is the activator this option installs. It returns an SDK `ClientArtifactsActivator`, so you can pass it as `artifactActivator` when you create a Chronicle client yourself. This also requires `@cratis/chronicle` 6.17.0 or later. On 6.16 an event delivery fails instead of running with the wrong correlation; SDKs before 6.16 ignore `artifactActivator` and construct artifacts themselves, and Arc cannot detect that for a client you create.

```typescript title="main.ts (excerpt)"
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';
import { chronicleArtifactActivator } from '@cratis/arc.chronicle';

let application: Awaited<ReturnType<typeof builder.build>> | undefined;
const artifactActivator = chronicleArtifactActivator(() => application!.server, 'MyArcApp');
const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { artifactActivator }));

application = await builder.withChronicle({ client, eventStore: 'MyArcApp' }).build();
// Start observing with the client only now: the activator needs the built application.
```

The caller owns the ordering:

- Build Arc before the client starts observing. A delivery that arrives earlier finds no application; the delivery fails and Chronicle retries it.
- You register the reactors, reducers and their dependencies yourself, and Arc does not check them when building.
- The activator joins Arc's shutdown only after its first activation. Before disposing Arc, stop the client, or call `artifactActivator.stop()` and then `await artifactActivator.drain()`, so no delivery is still using services that `application.dispose()` releases.

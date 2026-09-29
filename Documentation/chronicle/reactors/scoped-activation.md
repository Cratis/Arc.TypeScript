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

Scoped activation requires `@cratis/chronicle` 6.17.0 or later, the lowest version `@cratis/arc.chronicle` accepts as a peer. To use a Chronicle client you create yourself, see [Use a caller-owned client](#use-a-caller-owned-client).

With the option set, Chronicle-only artifacts that `discover(...)` found before `withChronicle` was called are registered with Chronicle too. Without it, registration is unchanged.

With the option set, building the application checks each reactor's and reducer's registration and its constructor dependencies, without constructing any of them. A missing service, a constructor Arc cannot bind (for example constructor parameters without `inject` tokens or decorator metadata), or a singleton artifact that depends on a scoped service fails the build, and the error names the artifact.

## What a delivery gets

For each delivery Chronicle makes to a reactor or reducer, Arc:

- rejects it unless it comes from the configured event store;
- creates a service scope and resolves the artifact from it, so constructor dependencies are shared by every event in the batch and not by the next batch;
- sets `currentContext()` for each handler: the tenant is the observation's namespace, the correlation is the handled event's correlation, there is no principal, the signal is cancelled when Chronicle cancels the delivery or the application shuts down, and warnings are allowed;
- pins Arc's Chronicle services in the scope to the event store Chronicle delivered from: `ChronicleReadModels`, command read models, `commandAggregate` and the events commands return all use that store, never a store the application's own Chronicle client looks up;
- handles a replay notification in its own scope, with a newly generated correlation;
- disposes the scope after the batch and before Chronicle acknowledges it.

Commands a handler returns follow the rules in [Returning commands from a reactor](command-side-effects.md): they run in the observation's tenant with no principal, or with a system principal when the reactor uses `@executeCommandsAsSystem`. They run one at a time in the order returned, with the handled event's correlation, and the first failure fails the delivery without running the rest. Each command receives the delivery's signal and uses the delivery's event store. Arc checks the signal before starting each command, so a cancelled delivery runs no further commands. A command that runs in another event store or namespace than the delivery fails instead of falling back to the application's client.

### The tenant in a single-tenant application

The tenant is the observation's namespace as Chronicle reports it, so in an application without tenancy a handler sees `Default`, not an unset tenant. `Default` addresses the same data as an unset tenant: Chronicle maps both to the `Default` namespace, and the MongoDB and Drizzle integrations map it to the base database. Arc keeps `Default` rather than clearing it because those integrations require a tenant and fail without one, and because the commands a reactor returns already run with the namespace as their tenant, so a handler and its commands agree.

A registration you make yourself still wins. A reactor registered as a singleton is shared by all deliveries and is disposed with the application, not after each batch; it cannot depend on scoped services.

## Failures

- If constructing the artifact fails, Arc disposes the services it already created. When that cleanup also fails, the error combines both failures.
- If disposing the scope fails, the delivery fails, even when every handler succeeded. When a handler also failed, both errors are kept.

A failed delivery is retried. It is not rolled back: appended events, commands and other side effects that already ran stay done and can run again, so handlers must be idempotent.

## Shutdown

When the application shuts down, Arc stops accepting new deliveries, aborts `currentContext().signal` for running handlers, and waits for them to finish and dispose their scopes. Only then does it dispose services, and an Arc-owned Chronicle client is closed last, so the connection stays open while admitted deliveries finish. Cancellation is cooperative: a handler that ignores the signal delays shutdown until it settles. A delivery that arrives after shutdown has started is rejected without touching services.

## Use a caller-owned client

`chronicleArtifactActivator(server, eventStore)` from `@cratis/arc.chronicle` is the activator the option installs on an Arc-owned connection. For a Chronicle client you create yourself, pass it as `artifactActivator`, together with `reactorCommandResultHandler` as `reactorResultHandler`, and set `activateArtifactsInScopes` with the client:

```typescript title="main.ts (excerpt)"
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';
import { chronicleArtifactActivator, reactorCommandResultHandler } from '@cratis/arc.chronicle';

let application: Awaited<ReturnType<typeof builder.build>> | undefined;
const server = () => application!.server;
const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
    artifactActivator: chronicleArtifactActivator(server, 'MyArcApp'),
    reactorResultHandler: reactorCommandResultHandler(server, 'MyArcApp')
}));

application = await builder.withChronicle({ client, eventStore: 'MyArcApp', activateArtifactsInScopes: true }).build();
// Start observing with the client only now: the activator needs the built application.
```

Registration verifies only that the client was created with an activator from `chronicleArtifactActivator` for the same event store; passing `reactorCommandResultHandler(...)` as `reactorResultHandler` is your responsibility, and without it returned commands are not executed through Arc. Arc never changes the client's options and never disposes the client. With the client registered this way, Arc checks the reactors' and reducers' registrations when building, as it does for an Arc-owned connection.

The caller owns the ordering:

- Build Arc before the client starts observing. A delivery that arrives earlier finds no application; the delivery fails and Chronicle retries it.
- Returned commands receive the delivery's signal and event store only when the client also has `reactorCommandResultHandler` as its `reactorResultHandler`.
- Dispose Arc first, then the client: `await application.dispose()` stops the activator and waits for admitted deliveries while the connection is still open, then `client.dispose()` stops observing. Deliveries that arrive in between are rejected.

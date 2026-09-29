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

Registration rejects the option together with `client`, because caller-owned clients are not supported yet.

With the option set, building the application checks each reactor's and reducer's registration and its constructor dependencies, without constructing any of them. A missing service or a singleton artifact that depends on a scoped service fails the build.

## What a delivery gets

For each delivery Chronicle makes to a reactor or reducer, Arc:

- rejects it unless it comes from the configured event store;
- creates a service scope and resolves the artifact from it, so constructor dependencies are shared by every event in the batch and not by the next batch;
- sets `currentContext()` for each handler, and for the events and commands it returns: the tenant is the observation's namespace, the correlation is the handled event's correlation, there is no principal, and warnings are allowed;
- handles a replay notification in its own scope, with a newly generated correlation;
- disposes the scope after the batch and before Chronicle acknowledges it.

A registration you make yourself still wins. A reactor registered as a singleton is shared by all deliveries and is disposed with the application, not after each batch; it cannot depend on scoped services.

## Failures

- If constructing the artifact fails, Arc disposes the services it already created. When that cleanup also fails, the error combines both failures.
- If disposing the scope fails, the delivery fails, even when every handler succeeded. When a handler also failed, both errors are kept.

A failed delivery is retried. It is not rolled back: appended events, commands and other side effects that already ran stay done and can run again, so handlers must be idempotent.

## Shutdown

When the application shuts down, Arc stops accepting new deliveries, aborts `currentContext().signal` for running ones, and waits for them to finish and dispose their scopes before it disposes services. Cancellation is cooperative: a handler that ignores the signal delays shutdown until it settles.

## Use the activator directly

`chronicleArtifactActivator(server, eventStore)` from `@cratis/arc.chronicle` is the activator this option installs. It returns an SDK `ClientArtifactsActivator`, so you can pass it as `artifactActivator` when you create a Chronicle client yourself:

```typescript title="main.ts (excerpt)"
import { chronicleArtifactActivator } from '@cratis/arc.chronicle';

let application: Awaited<ReturnType<typeof builder.build>> | undefined;
const artifactActivator = chronicleArtifactActivator(() => application!.server, 'MyArcApp');
```

In that case you register the artifacts and their dependencies yourself, and Arc does not check them when building.

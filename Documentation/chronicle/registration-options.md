---
title: Chronicle registration options
description: The options withChronicle accepts, where it reads them from configuration, which one wins, who owns the Chronicle client, and what registration rejects.
---

`withChronicle` connects an Arc application to one Chronicle event store. This page lists what it accepts and what it does with each value. [Add event sourcing](add-event-sourcing.md) walks through a first registration against a local kernel.

## Two ways to call it

```typescript title="main.ts (excerpt)"
import '@cratis/arc.chronicle';

builder.withChronicle({ connectionString: 'chronicle://localhost:35000', eventStore: 'MyArcApp' });
```

Importing `@cratis/arc.chronicle` adds the `withChronicle` method to the Node builder and to the Fetch API builder from `@cratis/arc.core/fetch`. The package also exports the function `withChronicle(builder, options)`, which does the same; the [Library sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/main.ts) uses that form.

The integration records the event types, projections, reducers, reactors, and constraints Arc discovers. A class with Arc metadata is recorded whether `discover(...)` runs before or after `withChronicle`. A Chronicle-only class, one without an Arc decorator, is picked up only when `withChronicle` runs first, so call it before `discover(...)`. The same goes for `add(...)`, which otherwise rejects such a class. With [`activateArtifactsInScopes`](reactors/scoped-activation.md) on, Chronicle-only classes discovered earlier are picked up too. Arc-owned clients pass the registered artifacts to the SDK and set `discoveryPatterns: []`, so they do not depend on SDK file scanning. For a caller-owned client, import and register your artifacts explicitly or configure its `discoveryPatterns`. Since SDK 6.10.0, compiled JavaScript entry points no longer scan `.ts` files by default; explicit patterns still apply.

Each recorded reactor and reducer also gets a scoped service registration in Arc, but only when nothing else registers that class. A registration in `builder.services` (before or after `withChronicle`), an entry in `options.services`, or an Arc lifetime decorator such as `@singleton()` always wins, and discovering an artifact twice does not add a second registration. With a caller-supplied `ServiceRegistry` in `options.services`, Arc adds no such registrations; register the artifacts yourself. By default Arc does not construct reactors or reducers through these registrations; the Chronicle SDK creates them. To opt in, see [Scoped activation](reactors/scoped-activation.md).

## Options

| Option | Type | Required | Meaning |
| --- | --- | --- | --- |
| `eventStore` | `string` | Yes | The event store every append and read uses. Chronicle creates it on first use |
| `connectionString` | `string` | One of `connectionString` and `client` | Arc creates, connects, and disposes the SDK client |
| `client` | `IChronicleClient` from `@cratis/chronicle` | One of `connectionString` and `client` | You own the client; see [Choose who owns the client](#choose-who-owns-the-client) |
| `completionTimeoutMs` | positive integer, milliseconds | No; no wait by default | After each successful append, wait until Chronicle's observers have processed it before the command answers. See [Choose Chronicle read consistency](../queries/read-consistency.md) |
| `readModelNamingPolicy` | `(identifier, readModelType?) => string` | No | Only with `connectionString`. Names the container each read model is stored in. Defaults to Arc's MongoDB collection name when `withMongoDB` is configured, otherwise to the read model identifier. See [Choose where read models are stored](#choose-where-read-models-are-stored) |
| `activateArtifactsInScopes` | `boolean` | No; off by default | Preview. Resolve reactors and reducers from Arc's container, one scope per delivery. With `client`, registration verifies only that the client was created with `chronicleArtifactActivator`; passing `reactorCommandResultHandler` as `reactorResultHandler` is up to you. See [Scoped activation](reactors/scoped-activation.md) |

Registration throws `Chronicle requires eventStore and exactly one of connectionString or client` when the event store is missing, or when neither or both of a connection string and a client are set.

Every append and read uses the current execution's tenant as the Chronicle namespace, or the `Default` namespace when no tenant is resolved. Tenancy you configure for Arc therefore also isolates events and read models. See [Tenancy](../tenancy/index.md).

:::caution[Development credentials]
`chronicle://localhost:35000` without credentials uses the SDK's development client and accepts the kernel's self-signed certificate. In production, put real client credentials in the connection string and validate the kernel's certificate. With SDK 6.10.0, `getEventStore(...)` rejects after three consecutive credential rejections instead of waiting indefinitely. [Chronicle connection strings](/chronicle/connection-strings/) lists the parameters.
:::

## Read the connection from configuration

`withChronicle` reads `Cratis:Chronicle` from the application's configuration: the `appsettings.json` in the working directory, its environment variant, and `Cratis__...` environment variables, as Arc does for its own [configuration](../configuration/index.md).

```json title="appsettings.json"
{
  "Cratis": {
    "Chronicle": {
      "connectionString": "chronicle://localhost:35000",
      "eventStore": "MyArcApp"
    }
  }
}
```

With that file, call `builder.withChronicle({})`. Keys are case-insensitive. To override the file in a deployment, set `Cratis__Chronicle__ConnectionString` and `Cratis__Chronicle__EventStore`. Only these two keys are read from configuration; `client`, `completionTimeoutMs`, and `readModelNamingPolicy` are set in code.

Values follow this precedence:

1. Options passed in code win over configuration.
2. Environment variables win over `appsettings.json`.
3. A `client` passed in code replaces a configured connection string, so the two never collide.

## Choose who owns the client

| Registration | Ownership |
| --- | --- |
| `{ connectionString, eventStore }` | Arc creates the SDK client with an artifact catalog for this application, and closes it when the application is disposed |
| `{ client, eventStore }` | You pass a caller-owned `IChronicleClient`. Arc never disposes it; your host calls `client.dispose()`. The client must already have an artifact provider that registers the event types, projections, reducers, and reactors you use |

An Arc-owned client is also wired so that [reactors can return Arc commands](reactors/command-side-effects.md). A caller-owned client needs that handler passed to the SDK before it connects; the reactor page shows how. To use [scoped activation](reactors/scoped-activation.md#use-a-caller-owned-client) with a caller-owned client, also pass `chronicleArtifactActivator` as its `artifactActivator`. Dispose the Arc application before the client, so deliveries still running finish while the connection is open.

## Choose where read models are stored

A projected read model is stored in a container, which is a MongoDB collection by default. The Chronicle SDK names it after the read model identifier unless it is given a `readModelNamingPolicy`, a function of the identifier and, when the SDK knows it, the read model class. It changes only the container name.

- **With `withMongoDB`.** An Arc-owned client gets a policy that returns the collection Arc's MongoDB integration reads for a class listed in `readModels`, so a projected read model lands where your queries look with no configuration. A class outside that list, and a read model known only by identifier, keep the identifier. This holds whichever of `withMongoDB` and `withChronicle` you call first. See [Naming policies](../mongodb/naming-policies.md#chronicle-projected-read-models) for the rule and for upgrading.
- **With your own `readModelNamingPolicy`.** It replaces the automatic policy. Return the identifier when `readModelType` is undefined.
- **Without `withMongoDB`.** Arc adds no policy, and the SDK default, the identifier, applies.
- **With a caller-owned `client`.** Arc never changes the client, so it sets no policy, and `withChronicle` throws if you also pass `readModelNamingPolicy`. Set the policy in the `ChronicleOptions` you create the client with.

The option needs `@cratis/chronicle` 6.29.0 or later.

## Related

- [Add event sourcing](add-event-sourcing.md)
- [The Cratis package](cratis-package.md)
- [Configuration](../configuration/index.md)

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

Call it before or after `discover(...)`. The integration records the event types, projections, reducers, reactors, and constraints discovered by Arc, including artifacts discovered earlier. For Chronicle-only artifacts passed to `add(...)`, call `withChronicle` first: Arc otherwise rejects them without an Arc decorator.

## Options

| Option | Type | Required | Meaning |
| --- | --- | --- | --- |
| `eventStore` | `string` | Yes | The event store every append and read uses. Chronicle creates it on first use |
| `connectionString` | `string` | One of `connectionString` and `client` | Arc creates, connects, and disposes the SDK client |
| `client` | `IChronicleClient` from `@cratis/chronicle` | One of `connectionString` and `client` | You own the client; see [Choose who owns the client](#choose-who-owns-the-client) |
| `completionTimeoutMs` | positive integer, milliseconds | No; no wait by default | After each successful append, wait until Chronicle's observers have processed it before the command answers. See [Choose Chronicle read consistency](../queries/read-consistency.md) |

Registration throws `Chronicle requires eventStore and exactly one of connectionString or client` when the event store is missing, or when neither or both of a connection string and a client are set.

Every append and read uses the current execution's tenant as the Chronicle namespace, or the `Default` namespace when no tenant is resolved. Tenancy you configure for Arc therefore also isolates events and read models. See [Tenancy](../tenancy/index.md).

:::caution[Development credentials]
`chronicle://localhost:35000` without credentials uses the SDK's development client and accepts the kernel's self-signed certificate. In production, put real client credentials in the connection string and validate the kernel's certificate. [Chronicle connection strings](/chronicle/connection-strings/) lists the parameters.
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

With that file, call `builder.withChronicle({})`. Keys are case-insensitive. To override the file in a deployment, set `Cratis__Chronicle__ConnectionString` and `Cratis__Chronicle__EventStore`. Only these two keys are read from configuration; `client` and `completionTimeoutMs` are set in code.

Values follow this precedence:

1. Options passed in code win over configuration.
2. Environment variables win over `appsettings.json`.
3. A `client` passed in code replaces a configured connection string, so the two never collide.

## Choose who owns the client

| Registration | Ownership |
| --- | --- |
| `{ connectionString, eventStore }` | Arc creates the SDK client with an artifact catalog for this application, and closes it when the application is disposed |
| `{ client, eventStore }` | You pass a caller-owned `IChronicleClient`. Arc never disposes it; your host calls `client.dispose()`. The client must already have an artifact provider that registers the event types, projections, reducers, and reactors you use |

An Arc-owned client is also wired so that [reactors can return Arc commands](reactors/command-side-effects.md). A caller-owned client needs that handler passed to the SDK before it connects; the reactor page shows how.

## Related

- [Add event sourcing](add-event-sourcing.md)
- [The Cratis package](cratis-package.md)
- [Configuration](../configuration/index.md)

---
title: Add event sourcing
description: Register the experimental Chronicle integration on the application builder with a connection string or a caller-owned client, and prepare the Node entry point.
---

This page adds Chronicle to an Arc application. When you finish, a command can [return events](commands/index.md) and a query can serve [projected read models](read-models/index.md). The Chronicle kernel runs as a separate process; start one before you run the application.

## Prepare the entry point

The Chronicle SDK uses `reflect-metadata`. Import it first in your entry point, before any decorated artifact is loaded:

```typescript title="main.ts"
import 'reflect-metadata';
```

## Register Chronicle

```typescript title="main.ts"
import 'reflect-metadata';
import { ArcApplication } from '@cratis/arc.core';
import '@cratis/arc.chronicle';

const builder = ArcApplication.createBuilder();
builder.withChronicle({ connectionString: 'chronicle://localhost:35000', eventStore: 'Tasks' });
await builder.discover(new URL('./Features/', import.meta.url));
const app = await builder.build();
await app.run();
```

Importing `@cratis/arc.chronicle` installs the typed `withChronicle` builder method, so `@cratis/arc.core` keeps no dependency on Chronicle. The exported function `withChronicle(builder, options)` does the same; the [Library sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/main.ts) uses that form.

Call `withChronicle` **before** you discover or add artifacts. The integration watches each registration and records every event type, projection, reducer, reactor, and constraint it sees in a catalog for this application. An artifact registered earlier never reaches Chronicle.

:::caution[Development credentials]
The connection string above uses the SDK's development credentials and accepts the kernel's self-signed certificate. In production, provide real credentials and `skipTlsValidation=false`.
:::

## Keep the connection string out of source

`withChronicle` also reads `Cratis:Chronicle` from the application's configuration, the same `appsettings.json` and `Cratis__...` environment variables Arc uses for its own [configuration](../configuration/index.md):

```json title="appsettings.json"
{
  "Cratis": {
    "Chronicle": {
      "connectionString": "chronicle://localhost:35000",
      "eventStore": "Library"
    }
  }
}
```

Then call `builder.withChronicle({})`. To override the file in a deployment, set `Cratis__Chronicle__ConnectionString` and `Cratis__Chronicle__EventStore`. Values passed in code win over the file and the environment, and a `client` passed in code replaces a configured connection string. Registration fails when no event store is set, or when neither or both of a connection string and a client are set.

## Choose who owns the client

| Registration | Ownership |
| --- | --- |
| `{ connectionString, eventStore }` | Arc creates the SDK client with its per-application artifact catalog and closes it with the application |
| `{ client, eventStore }` | You pass a caller-owned `IChronicleClient`. Arc never disposes it; your host calls `client.dispose()`. The client must already have an artifact provider that registers the event types, projections, reducers, and reactors you use |

Pass `eventStore` in either case. Every append and read uses the current execution's tenant as the Chronicle namespace, so tenancy you configure for Arc also isolates events.

An Arc-owned client is also wired so that [reactors can return Arc commands](reactors/command-side-effects.md). A caller-owned client needs that handler passed to the SDK before it connects; the reactor page shows how.

## Use the Cratis composition

`@cratis/cratis` composes Arc and the Chronicle integration in one import, the TypeScript counterpart of the .NET `Cratis` package:

```typescript title="main.ts"
import 'reflect-metadata';
import { CratisApplication } from '@cratis/cratis';

const builder = CratisApplication.createBuilder();
await builder.discover(new URL('./Features/', import.meta.url));
const app = await builder.build();
await app.run();
```

`CratisApplication.createBuilder(options, chronicle)` creates an Arc builder and registers Chronicle with the `chronicle` options, which default to the `Cratis:Chronicle` configuration. After importing `@cratis/cratis`, `builder.addCratis({ eventStore, connectionString })` does the same on a builder you created yourself. The package re-exports `@cratis/arc.core` and `@cratis/arc.chronicle`, and `@cratis/cratis/testing` re-exports `@cratis/arc.testing` and `@cratis/arc.chronicle/testing`.

`@cratis/cratis` is experimental like the integration it composes, and it is not published to npm. It does not install an authentication handler. If your routes need authentication, pass one in `CratisApplication.createBuilder({ authentication: [...] })`, as you would to `ArcApplication.createBuilder`; see [Authentication](../core/authentication.md). Public routes need no handler.

## Check it

Run a command that returns an event, then read the event back with the Chronicle Workbench or the `cratis` CLI against the same event store and tenant namespace. A 400 answer with a `constraintViolation` or `concurrencyViolation` reason means Chronicle rejected the append; see [Concurrency](commands/concurrency.md). A connection failure fails the command with an exception.

Next, [return events](commands/index.md) from a command.

## Related

- [Chronicle](index.md)
- [Reactors](reactors/index.md)
- [Testing Chronicle commands](../testing/chronicle.md)

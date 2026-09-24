---
title: Add event sourcing
description: Register the experimental Chronicle integration on the application builder with a connection string or a caller-owned client, and prepare the Node entry point.
---

This page adds Chronicle to an Arc application. After it, commands can [return events](commands/index.md).

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

Importing `@cratis/arc.chronicle` registers a typed builder extension without modifying the builder prototype. Call `withChronicle` **before** discovering or adding artifacts, so the integration sees your event types, projections, reducers, and reactors. `addChronicle` remains a deprecated alias. To avoid keeping a connection string in source, put `Cratis:Chronicle:{ConnectionString,EventStore}` in `appsettings.json` or override it with `Cratis__Chronicle__ConnectionString` and `Cratis__Chronicle__EventStore`, then call `builder.withChronicle({})`. Code options win over file and environment settings. The Chronicle engine must run separately.

The experimental private `@cratis/cratis` composition has a shorter TypeScript path (under 20 lines):

```typescript
import 'reflect-metadata';
import { CratisApplication } from '@cratis/cratis';
const builder = CratisApplication.createBuilder();
await builder.discover(new URL('./Features/', import.meta.url));
const app = await builder.build();
await app.run();
```

Its `createBuilder()` mirrors C#'s `builder.AddCratis()` followed by `app.UseCratis()`, but **does not** install Microsoft identity automatically. Supply an Arc authentication handler explicitly in `ArcApplication.createBuilder({ authentication: [...] })` or in `CratisApplication.createBuilder({ authentication: [...] })` before hosting. C#'s setup is:

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.AddCratis();
var app = builder.Build();
app.UseCratis();
app.Run();
```

Both paths require a separately running Chronicle server. The TS package is a local preview, not published or verified against a live kernel by this example.

:::caution[Development credentials]
The connection string above uses the SDK's development credentials and accepts the kernel's self-signed certificate. In production, provide real credentials and `skipTlsValidation=false`.
:::

## Choose who owns the client

| Registration | Ownership |
| --- | --- |
| `{ connectionString, eventStore }` | Arc creates the SDK client, with a per-builder catalog of the artifacts you `add` or `discover`, and closes it with the application |
| `{ client, eventStore }` | You pass a caller-owned `IChronicleClient`. Arc never disposes it; your host calls `client.dispose()`. The client must already have a provider that registers the event types, projections, reducers, and reactors you use |

Pass `eventStore` in either case. Every append and read uses the current execution's tenant as the Chronicle namespace.

## Related

- [Returning events](commands/index.md)
- [Chronicle](index.md)

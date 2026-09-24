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
builder.addChronicle({ connectionString: 'chronicle://localhost:35000', eventStore: 'Tasks' });
await builder.discover(new URL('./Features/', import.meta.url));
const app = await builder.build();
await app.run();
```

Importing `@cratis/arc.chronicle` adds `addChronicle` to the builder. Call it **before** discovering or adding artifacts, so the integration sees your event types, projections, reducers, and reactors.

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

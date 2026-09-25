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

The equivalent C# setup, alongside the TypeScript `builder.withChronicle(...)` above, is:

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.AddCratisArc(configureBuilder: arc => arc.WithChronicle());
var app = builder.Build();
app.UseCratisArc();
app.Run();
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

Its `createBuilder()` mirrors C#'s `builder.AddCratis()` followed by `app.UseCratis()`. You can also call `builder.addCratis({ eventStore, connectionString })` after importing `@cratis/cratis` instead of using `CratisApplication.createBuilder()`. Neither path installs authentication automatically. If your routes need authentication, supply an Arc handler in `ArcApplication.createBuilder({ authentication: [...] })` or `CratisApplication.createBuilder({ authentication: [...] })` before hosting. Public routes need no handler. C#'s setup is:

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.AddCratis();
var app = builder.Build();
app.UseCratis();
app.Run();
```

Both paths require a separately running Chronicle server. The TS package is a local preview, not published. The integration has an opt-in live kernel suite; this setup example is not a live-kernel verification.

:::caution[Development credentials]
The connection string above uses the SDK's development credentials and accepts the kernel's self-signed certificate. In production, provide real credentials and `skipTlsValidation=false`.
:::

## Choose who owns the client

| Registration | Ownership |
| --- | --- |
| `{ connectionString, eventStore }` | Arc creates the SDK client, with a per-builder catalog of the artifacts you `add` or `discover`, and closes it with the application |
| `{ client, eventStore }` | You pass a caller-owned `IChronicleClient`. Arc never disposes it; your host calls `client.dispose()`. The client must already have a provider that registers the event types, projections, reducers, and reactors you use |

Pass `eventStore` in either case. Every append and read uses the current execution's tenant as the Chronicle namespace.

## Return Arc commands from reactors

With Chronicle SDK 6.6.0 or later, a reactor may return an `@command()` instance or a nonempty array containing **only** Arc commands. Arc executes each command through its validation, authorization, and normal command pipeline, in the triggering event's namespace. A failed command throws at the reactor boundary, so the observer partition fails rather than acknowledging a partial side effect. The commands run in order; a later failure does not undo an earlier committed command. Keep side effects idempotent for re-delivery.

For example, a reactor can translate a recorded event into another command's intent:

```typescript
import { reactor } from '@cratis/chronicle/reactors';
import type { EventContext } from '@cratis/chronicle/events';
import { executeCommandsAsSystem } from '@cratis/arc.chronicle';
import { LiveCreated, FollowUpLive } from './LiveArtifacts.js';

@executeCommandsAsSystem('writers')
@reactor()
export class LiveCommandReactor {
    liveCreated(event: LiveCreated, context: EventContext): FollowUpLive {
        return Object.assign(new FollowUpLive(), { id: context.eventSourceId, name: event.name });
    }
}
```

`LiveCreated` is an SDK `@eventType()` class; `FollowUpLive` is an Arc `@command()` with `@field(String) @key() id` and a `@field(String) name`. The exact integration example is exercised in the [live suite](https://github.com/Cratis/Arc.TypeScript/blob/main/Source/Chronicle/Integration/LiveArtifacts.ts).

With an Arc-owned client (`{ connectionString, eventStore }`), `withChronicle` installs the result handler before observations begin. For a caller-owned client, pass the handler to the SDK when creating the client **before connecting it**:

```typescript
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';
import { reactorCommandResultHandler } from '@cratis/arc.chronicle';

// Capture the application built later; the SDK invokes this only during observation.
let application: Awaited<ReturnType<typeof builder.build>>;
const client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString, {
    clientArtifactsProvider: artifacts,
    reactorResultHandler: reactorCommandResultHandler(() => application.server, 'Tasks')
}));
builder.withChronicle({ eventStore: 'Tasks', client });
application = await builder.build();
```

Here `builder`, `connectionString`, and `artifacts` are your configured Arc builder, Chronicle connection string, and SDK artifact provider. Register reactor, command, and event types before building. `reactorCommandResultHandler` declines event-only returns so Chronicle appends them using its own event-side-effect path. **Do not mix returned commands with events or other values in one array**: Arc rejects the mixture rather than silently dropping an item. Return either all commands or all events.

Returned commands have no Arc principal by default, as in .NET. When a command requires a system role, decorate the **reactor class** with `@executeCommandsAsSystem('role-name')` from `@cratis/arc.chronicle`. This supplies a system principal to returned commands (not to imperative calls made inside the reactor). The SDK identity for their appends is the triggering event's identity by default, or the system identity when the decorator is present; the command's causation includes the event source, event type, sequence number, store, and namespace. The commands retain the triggering event's correlation ID. No distributed transaction spans the reactor's commands and the triggering event.

## Related

- [Returning events](commands/index.md)
- [Chronicle](index.md)

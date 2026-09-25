---
title: Returning commands from a reactor
description: Return Arc commands from a Chronicle reactor so they run through validation and authorization, give them a system principal, and know the failure, tenancy, and retry rules.
---

When a book is added to the catalog, the search index should follow. The indexing command already exists, with its validation and its role check. Instead of calling a service from the reactor and repeating those checks, return the command, and Arc runs it through the same pipeline an HTTP caller would use.

This relies on the SDK's reactor result hook, available in the Chronicle SDK 6.7.0 the integration requires.

## Return a command

```typescript title="Catalog.ts"
import { field } from '@cratis/fundamentals';
import { eventType, type EventContext } from '@cratis/chronicle/events';
import { reactor } from '@cratis/chronicle/reactors';
import { command, key, roles } from '@cratis/arc.core';
import { executeCommandsAsSystem } from '@cratis/arc.chronicle';

@eventType()
export class BookAdded {
    @field(String) title: string;
    constructor(title = '') { this.title = title; }
}

@eventType()
export class BookIndexed {
    @field(String) title: string;
    constructor(title = '') { this.title = title; }
}

@command()
@roles('CatalogWriter')
export class IndexBook {
    @field(String) @key() id = '';
    @field(String) title = '';
    constructor(id = '', title = '') { this.id = id; this.title = title; }

    handle(): BookIndexed { return new BookIndexed(this.title); }
}

@executeCommandsAsSystem('CatalogWriter')
@reactor()
export class CatalogIndexer {
    bookAdded(event: BookAdded, context: EventContext): IndexBook {
        return new IndexBook(context.eventSourceId, event.title);
    }
}
```

Register all four with `builder.add(...)` or `builder.discover(...)` after `withChronicle`. When a `BookAdded` is appended, Chronicle calls `bookAdded`, and Arc executes `IndexBook`: authorization, validation, `provide()`, `handle()`, and the append of `BookIndexed`. The book ID comes from the triggering event's context, not from the event payload.

## Who runs the command

A reactor is not an HTTP request, so no caller is signed in. A returned command runs with **no principal** by default, as in Arc on .NET. A command without authorization rules runs normally; one with `@roles`, `@authorize`, or a policy is rejected.

`@executeCommandsAsSystem('CatalogWriter')` on the reactor class gives the commands it returns an authenticated system principal with exactly the roles you list. Grant only the roles those commands need. The decorator covers returned commands only; a command you execute yourself inside the handler gets nothing from it.

| Value | Without the decorator | With the decorator |
| --- | --- | --- |
| Arc principal | None | System, with the listed roles |
| Tenant | The triggering event's namespace | Same |
| Correlation ID | The triggering event's correlation ID | Same |
| Causation | A `ReactorEvent` entry with the event source ID, event type, sequence number, event store, and namespace, followed by the command | Same |

Events the commands append carry Chronicle's system identity in both cases: the command has no signed-in user, and the principal the decorator supplies is the system identity. Arc executes the commands with an allowed severity of Warning, so warnings do not block and errors do.

## Return several commands

Return a nonempty array that contains only commands:

```typescript
bookRemoved(event: BookRemoved, context: EventContext): (ArchiveBook | RemoveFromIndex)[] {
    return [new ArchiveBook(context.eventSourceId), new RemoveFromIndex(context.eventSourceId)];
}
```

This handler fragment assumes `BookRemoved` is an event type and `ArchiveBook` and `RemoveFromIndex` are commands in your application. Arc runs the commands in order and stops at the first one that fails. Each command is its own execution with its own [batch](../commands/transactional-commands.md): when the second fails, the first has already committed and stays committed.

Do not mix commands with events or other values in one array. Arc rejects the mixture, and the handler fails, instead of silently dropping an item. Return either only commands or only events.

## When a command fails

A returned command that fails, whether rejected by authorization or validation or by throwing, fails the handler with a message naming the command, the event store, and the namespace. Chronicle marks the observer partition as failed rather than acknowledging a partial side effect. When Chronicle delivers the event again, the handler returns the commands again, including any that succeeded the first time.

Make the commands safe to repeat. Key them by the triggering event source, check current state in [`provide()` or a read model](../read-models/injecting-into-commands.md), or rely on a Chronicle constraint to reject the duplicate. The TypeScript SDK has no replay exclusion like .NET's `[OnceOnly]`.

No transaction spans the triggering event and the commands. The triggering event is already committed when the reactor runs.

## Use a caller-owned client

With an Arc-owned client (`{ connectionString, eventStore }`), `withChronicle` installs the result handler before observation starts. For a client you create yourself, pass `reactorCommandResultHandler` to the SDK **before the client connects**:

```typescript title="main.ts (excerpt)"
import { ChronicleClient, ChronicleOptions } from '@cratis/chronicle';
import { ArcApplication } from '@cratis/arc.core';
import { ChronicleArtifacts, reactorCommandResultHandler } from '@cratis/arc.chronicle';
import { BookAdded, CatalogIndexer, IndexBook } from './Catalog.js';

const artifacts = new ChronicleArtifacts();
for (const type of [BookAdded, CatalogIndexer, IndexBook]) artifacts.register(type);

let application: ArcApplication | undefined;
const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', {
    clientArtifactsProvider: artifacts,
    discoveryPatterns: [],
    reactorResultHandler: reactorCommandResultHandler(() => application!.server, 'Catalog')
}));

const builder = ArcApplication.createBuilder();
builder.withChronicle({ client, eventStore: 'Catalog' });
builder.add(BookAdded, CatalogIndexer, IndexBook);
application = await builder.build();
```

The SDK calls the handler only while observing, after `build()` has assigned `application`. The second argument names the event store Arc appends to; a reactor observing a different store fails instead of running commands in the wrong place. The handler declines results that contain no command, so events returned from other reactors keep the SDK's own append path.

## Related

- [Reactors](index.md)
- [Transactional commands](../commands/transactional-commands.md)
- [Command pipeline](../../commands/command-pipeline.md)
- [Chronicle reactors](/chronicle/reactors/)

---
title: Event source definitions
description: Route a command's events, and an aggregate's, through a Chronicle event source definition and stream, and know what Arc validates at startup and what Chronicle enforces on append.
---

A string such as `@eventSourceType('Account')` names where an event goes, but nothing checks that the name exists or that the stream belongs to it. A Chronicle event source definition is that check: a registered class that declares a source and its streams. A command selects one with `@eventSourceDefinition`, and each event it returns records the definition it was appended through.

Source and stream are routing. You declare them on the command or the aggregate, never on an event type.

This feature needs `@cratis/chronicle` 6.49.0 or later. Older SDKs keep working for string routing, and a command that selects a definition fails with a message naming the required version.

## Declare a definition and select it

Declare the definition with the SDK's decorators, then select it on the command.

```typescript
import { field } from '@cratis/fundamentals';
import { ConcurrencyDimensions, eventSource, eventStream } from '@cratis/chronicle';
import { command, key } from '@cratis/arc.core';
import { eventSourceDefinition } from '@cratis/arc.chronicle';

@eventSource()
@eventStream('Transactions', { concurrency: ConcurrencyDimensions.eventStreamType | ConcurrencyDimensions.eventStreamId })
export class Account {}

@eventSourceDefinition(Account, 'Transactions')
@command()
export class Deposit {
    @field(String) @key() id = '';
    handle(): FundsDeposited { return new FundsDeposited(); }
}
```

`FundsDeposited` is an `@eventType()` class. The event is appended with source `Account` and stream type `Transactions`. Chronicle records the definition on the event, and a reactor or projection reads it from `EventContext.eventSource`.

The first argument is the class, its registered name, or a function returning the class. Use the function form, `@eventSourceDefinition(() => Account, 'Transactions')`, when the definition's module imports the command and the plain class would be read before it is defined.

Referencing the class registers it with Chronicle, so you do not add it to discovery separately. A name can only be resolved against definitions that are registered, so a name Arc cannot find fails at startup.

## What fails at startup

Arc checks every command that selects a definition when the application is built, without a connection, and refuses to build when:

- the class is not decorated with `@eventSource()`;
- the stream is not one the definition declares;
- a name matches no registered definition; or
- `@eventSourceType` or `@eventStreamType` on the same command contradicts the definition. Repeating the definition's own name is allowed.

An aggregate, which Arc only meets when a command uses it, is checked the first time it loads.

## Concurrency comes from the definition

When a command selects a definition and sets no concurrency flags, Arc passes no scope and Chronicle derives one from the dimensions the definition or stream declares. Explicit flags win: `@eventStreamId('2026-05', { concurrency: true })` builds the same explicit scope as without a definition, using the definition's source name, and Chronicle then derives nothing.

Chronicle's client refuses events for one event source ID that would need different automatic scopes within a single batch. Arc does not work around that; the command fails and appends nothing. Pass an explicit scope with `eventsWithConcurrencyScopes`, or return the events in separate commands.

## Override one event

An event entry that names its own `eventSource` and `eventStream`, or its own raw `eventSourceType` or `eventStreamType`, takes over source and stream for that event as one unit. The command's definition is neither merged into it nor used to rewrite it.

```typescript
import { eventForEventSourceId } from '@cratis/arc.chronicle';

handle() {
    return eventForEventSourceId({ eventSourceId: this.id, event: new FundsPosted(),
        eventSource: Ledger, eventStream: 'Postings' });
}
```

A raw `eventStreamType` on an entry wins over the command's definition the same way, and the entry is appended without a definition. The stream ID stays a separate default from `getEventStreamId()`.

## Aggregates

Declare the definition on the aggregate class to guard and rehydrate only that source and stream.

```typescript
@eventSourceDefinition(Account, 'Transactions')
export class Wallet extends AggregateRoot {
    constructor() { super(); this.on(FundsDeposited, () => {}); }
}
```

Loading reads the tail and the events for the declared source and stream only, the concurrency scope carries the same source and stream, and every event the aggregate applies records the definition. A command and its aggregate may each declare a definition when they agree; two that name different sources or streams fail instead of one silently winning.

## Related

- [Event metadata](event-metadata.md)
- [Concurrency](concurrency.md)
- [Defining an aggregate root](../aggregates/defining-an-aggregate-root.md)

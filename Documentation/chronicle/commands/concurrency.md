---
title: Concurrency
description: Reject a Chronicle append when an event source moved, with routing-decorator tail checks, exact concurrency scopes, or an aggregate, and read the validation result a rejection produces.
---

Two librarians open the same book and both mark it as lent. Without a check, both commands succeed and the book is lent twice. Optimistic concurrency makes the second append fail: Chronicle compares the stream's current tail with the tail the command expected, and rejects the append when they differ.

The integration gives you three ways to state that expectation. Choose by how the command decides.

| The command decides from | Use |
| --- | --- |
| Nothing it read; it only needs no one else to write in between | A routing decorator with `{ concurrency: true }` |
| An empty stream, such as "create once" | An exact scope with `EventSequenceNumber.beforeFirst` |
| The event source's history | An [aggregate](../aggregates/index.md), which carries the revision it replayed |

For a rule across event sources, such as a unique author name, use a Chronicle constraint instead. The [Library sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/Features/Authors/Registration/Registration.ts) registers `UniqueAuthorName` beside its command.

## Check the tail with a routing decorator

```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { command, key } from '@cratis/arc.core';
import { eventSourceType } from '@cratis/arc.chronicle';

@eventType()
export class BookLent {
    @field(String) borrower: string;
    constructor(borrower = '') { this.borrower = borrower; }
}

@command()
@eventSourceType('Book', { concurrency: true })
export class LendBook {
    @field(String) @key() bookId = '';
    @field(String) borrower = '';

    handle(): BookLent { return new BookLent(this.borrower); }
}
```

`{ concurrency: true }` works the same on `@eventSourceType`, `@eventStreamType`, and `@eventStreamId`. When the command returns its events, the integration reads the tail of each event source in the batch, narrowed to the dimensions you marked, and sends that tail as the expected revision. A write that lands between that read and the append is rejected.

The tail is read **after** `handle()` has run. A write that landed while `handle()` was deciding is already part of that tail, so this check does not protect a decision made from state read earlier. For a read-modify-write rule, carry the revision you read, as the next two sections do.

## Pin the revision with an exact scope

```typescript
import { field } from '@cratis/fundamentals';
import { EventSequenceNumber } from '@cratis/chronicle/eventSequences';
import { command, key } from '@cratis/arc.core';
import { eventsWithConcurrencyScopes } from '@cratis/arc.chronicle';

@command()
export class CreateLiveExactlyOnce {
    @field(String) @key() id = '';
    @field(String) name = '';
    handle() {
        return eventsWithConcurrencyScopes([new LiveCreated(this.name)], {
            [this.id]: { eventSourceId: true, sequenceNumber: EventSequenceNumber.beforeFirst.value }
        });
    }
}
```

This excerpt is from the [kernel suite](https://github.com/Cratis/Arc.TypeScript/blob/main/Source/Chronicle/Integration/LiveArtifacts.ts), where `LiveCreated` is an `@eventType()` class. `eventsWithConcurrencyScopes(events, scopes)` sends each scope exactly as you wrote it. `EventSequenceNumber.beforeFirst.value` is the expected tail of a stream with no events, so the command succeeds once per ID; the second call is rejected.

Each scope is keyed by an event source ID and accepts:

| Field | Meaning |
| --- | --- |
| `sequenceNumber` | The expected tail, a `bigint` |
| `eventSourceId` | `true` to scope to that event source |
| `eventSourceType`, `eventStreamType`, `eventStreamId` | Narrow the scope to that source type or stream |
| `eventTypes` | Narrow the scope to these event types |

A scope may name an event source the batch does not append to, which lets a decision about one source guard against changes to another. An exact scope replaces the routing-decorator check for the same source. The kernel requires at least one event in a batch, so **a batch with scopes and no events fails**.

## Let an aggregate carry it

An aggregate records the tail of its route when it is loaded, and the events it applies are appended with that tail as an exact scope. A concurrent append on the same route between load and commit rejects the batch. See [Aggregates](../aggregates/injecting-into-commands.md).

## When the check fails

A concurrency or constraint rejection becomes a validation result. The caller gets 400, the command result carries no response, and nothing from the batch is appended.

| Rejection | `reason` | `message` | Other fields |
| --- | --- | --- | --- |
| Concurrency | `concurrencyViolation` | `Concurrent modification prevented the append` | `state` with `eventSourceId`, `expectedEventSequenceNumber`, and `actualEventSequenceNumber` |
| Constraint | `constraintViolation` | The constraint's message | `members` holds the constrained property in camel case when Chronicle reports one; `reasonDetail` holds the constraint ID |

Both have error severity. A client can show the message or retry the command with fresh state.

An unknown, incomplete, contradictory, or partial acknowledgment from Chronicle is not a rejection. The command fails with an exception, because Arc cannot tell what was stored.

## Nested commands and tests

Nested commands that share a batch may each add scopes. Two different scopes for the same event source fail the command instead of silently keeping one.

The in-memory [test scenario](../../testing/chronicle.md) accepts scopes but does not enforce them. Only a kernel does.

## Related

- [Transactional commands](transactional-commands.md)
- [Resolving the event source ID](../resolving-event-source-id.md)
- [Chronicle constraints](/chronicle/constraints/)

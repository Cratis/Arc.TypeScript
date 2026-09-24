---
title: Concurrency
description: Reject a Chronicle append when an event source moved, with exact concurrency scopes or routing-decorator tail checks, and map the rejection to validation.
---

Two people register the same task at the same moment. Without a concurrency check, both appends succeed. The integration offers two ways to make the second one fail.

## Exact scopes

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
        return eventsWithConcurrencyScopes([Object.assign(new LiveCreated(), { name: this.name })], {
            [this.id]: { eventSourceId: true, sequenceNumber: EventSequenceNumber.beforeFirst.value }
        });
    }
}
```

This excerpt is from the [kernel suite](https://github.com/Cratis/Arc.TypeScript/blob/main/Source/Chronicle/Integration/LiveArtifacts.ts), where `LiveCreated` is an `@eventType()` class. `eventsWithConcurrencyScopes(events, scopes)` carries exact, server-authored revisions. `EventSequenceNumber.beforeFirst.value` is the expected revision of a stream with no events, so this command succeeds once per ID. Scope keys may refer to other sources than the appended events.

The kernel requires at least one event in a batch: **scope-only empty batches fail**.

## Routing-decorator tail checks

`{ concurrency: true }` on `@eventSourceType`, `@eventStreamType`, or `@eventStreamId` reads the tail immediately before the append and scopes that dimension. It does not pin the revision you used when you read state. For a read-modify-write rule, use exact scopes with the revision you read.

## When the check fails

Chronicle constraint and concurrency rejections become Arc validation results, so the caller gets 400 and nothing is appended. Unknown, incomplete, contradictory, or partial acknowledgments fail the command.

The in-memory [test scenario](../../testing/chronicle.md) accepts scopes but does not enforce them; only the kernel does.

## Related

- [Transactional commands](transactional-commands.md)
- [Resolving the event source ID](../resolving-event-source-id.md)

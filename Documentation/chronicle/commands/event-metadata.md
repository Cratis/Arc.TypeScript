---
title: Event metadata
description: What every event a command returns carries besides its payload, where the integration takes each value from, and how to override or read it.
---

An event records more than its payload. It also records which entity it belongs to, which stream within that entity, whose personal data it carries, when it happened, who caused it, and which request it was part of. You rarely want to set those by hand on every command. The integration resolves each value from the command and the request, and lets you override the ones that differ.

## What each event carries

| Metadata | Taken from | Override for one event |
| --- | --- | --- |
| Event source ID | `getEventSourceId()`, then the `@key()` field, then a new UUID; see [Resolving the event source ID](../resolving-event-source-id.md) | `tuple(eventSourceIdResponse(id), event)` or `eventForEventSourceId({ eventSourceId })` |
| Event source type | `@eventSourceType('Author')` on the command | `eventForEventSourceId({ eventSourceType })` |
| Event stream type | `@eventStreamType('Onboarding')` on the command | `eventForEventSourceId({ eventStreamType })` |
| Event stream ID | `getEventStreamId()` on the command, then `@eventStreamId('main')` | `eventForEventSourceId({ eventStreamId })` |
| Subject | `getSubject()`, then a `@subject()` field, then `@eventSubject(...)`, then the event source ID; see [Subject](subject.md) | `eventForEventSourceId({ subject })` |
| Tags | The SDK's `@tag` and `@tags` on the event class | `eventForEventSourceId({ tags })` adds tags for that append |
| Occurred | Set when the event is appended | `eventForEventSourceId({ occurred })` |
| Correlation ID | The request's correlation ID | None |
| Caused by | The signed-in principal, or Chronicle's system identity for an anonymous caller | None |
| Causation | An `Arc.Command` entry with the command name and its values; see [Causation and auditing](causation.md) | None |

Routing decorators come from `@cratis/arc.chronicle` and apply to every event the command returns. A value set on an `eventForEventSourceId` entry wins over the command's default for that entry only.

## Set command-wide defaults

```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { command, key } from '@cratis/arc.core';
import { eventSourceType, eventStreamType } from '@cratis/arc.chronicle';

@eventType()
export class OnboardingStarted {
    @field(String) plan: string;
    constructor(plan = '') { this.plan = plan; }
}

@command()
@eventSourceType('Customer')
@eventStreamType('Onboarding')
export class StartOnboarding {
    @field(String) @key() customerId = '';
    @field(String) plan = '';

    getEventStreamId(): string { return `onboarding-${this.plan}`; }

    handle(): OnboardingStarted { return new OnboardingStarted(this.plan); }
}
```

`OnboardingStarted` is appended to the customer's event source, with source type `Customer`, stream type `Onboarding`, and a stream ID computed per command. `getEventStreamId()` runs after validation, so it may read any field. When you also declare `@eventStreamId(...)`, the method wins.

The same stream settings select which events an [aggregate](../aggregates/injecting-into-commands.md) loads, so an aggregate and the events its command returns agree on the stream.

## Override one event

```typescript
import { eventForEventSourceId } from '@cratis/arc.chronicle';

handle() {
    return eventForEventSourceId({ eventSourceId: 'routed', event: new Registered(),
        eventSourceType: 'Override', subject: 'subject-1', tags: ['tag-1'] });
}
```

This excerpt is from the package's [scenario spec](https://github.com/Cratis/Arc.TypeScript/blob/main/Source/Chronicle/testing/for_ChronicleCommandScenario/when_executing/with_returned_events.ts), where `Registered` is an `@eventType()` class. The entry is branded, so an ordinary response object that happens to have `event` and `eventSourceId` fields is never mistaken for an event. Return an array to mix routed entries with plain events in one batch.

## Read it back

Chronicle hands the metadata back as an `EventContext`. A reactor receives it as the second handler argument; see [Reactors](../reactors/index.md). A model-bound projection can copy a context value into a read model with the SDK's `@setFromContext`:

```typescript
import { field } from '@cratis/fundamentals';
import { fromEvent, setFromContext } from '@cratis/chronicle/projections';
import { readModel } from '@cratis/arc.core';

@readModel()
@fromEvent(OnboardingStarted)
export class Onboarding {
    @field(String) id = '';
    @field(String) plan = '';
    @setFromContext(OnboardingStarted, 'occurred') @field(Date) startedAt!: Date;
}
```

`plan` is copied from the event by matching name, and `startedAt` takes the event's occurred time. In a test, `result.appendedEvents` on [`ChronicleCommandScenario`](../../testing/chronicle.md) exposes each appended event with its routing, subject, and tags.

## Related

- [Returning events](index.md)
- [Resolving the event source ID](../resolving-event-source-id.md)
- [Concurrency](concurrency.md), where the same routing decorators opt into tail checks

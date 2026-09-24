---
title: Resolving the event source ID
description: How the Chronicle integration picks the event source for returned events, how to return it to the caller, and how to route events to other sources and streams.
---

Every event belongs to an event source, such as one task. The integration takes the event source from the command unless you say otherwise.

## The default: the command key

| Command declares | Event source ID |
| --- | --- |
| `getEventSourceId()` | Its result; this takes precedence |
| A `@key()` field | That field's value |
| Neither | A new UUID for each execution |

The key is the same one Arc resolves for the [command context](../commands/command-context.md#give-a-command-a-key).

## Return the ID to the caller

`tuple(eventSourceIdResponse(id), event)` appends the event to `id` and returns `id` as the command's response, overriding the key. An ordinary `tuple(event, 'message')` still appends to the command key.

## Target another event source

```typescript
import { eventForEventSourceId } from '@cratis/arc.chronicle';

handle() {
    return eventForEventSourceId({ eventSourceId: 'routed', event: new Registered(),
        eventSourceType: 'Override', subject: 'subject-1', tags: ['tag-1'] });
}
```

This excerpt is from the package's [scenario spec](https://github.com/Cratis/Arc.TypeScript/blob/main/Source/Chronicle/for_ChronicleCommandScenario/when_executing/with_returned_events.ts). The explicit route, subject, occurred time, and tags override command defaults. The value is branded, so an ordinary DTO with `event` and `eventSourceId` fields is never mistaken for an event. The SDK's `@tag` and `@tags` on event classes still apply.

## Set command defaults with decorators

Class decorators from `@cratis/arc.chronicle` set routing defaults for every event a command returns:

| Decorator | Sets |
| --- | --- |
| `@eventSourceType('Task', { concurrency? })` | The event source type |
| `@eventStreamType('Onboarding', { concurrency? })` | The event stream type |
| `@eventStreamId('main', { concurrency? })` | The event stream ID |
| `@eventSubject('subject')` | The compliance subject |

`{ concurrency: true }` reads that dimension's tail immediately before the append and scopes it; see [Concurrency](commands/concurrency.md).

## Related

- [Returning events](commands/index.md)
- [Command context](../commands/command-context.md)

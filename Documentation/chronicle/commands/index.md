---
title: Returning events
description: Return a Chronicle event, a batch of events, or events next to a response from a model-bound command, and know which returned values are appended.
---

A command decides what happened; the integration appends it. Return the event from `handle()`, and Arc appends it only after authorization, validation, and `provide()` have passed.

## Return an event

This excerpt is from the compiled [kernel suite](https://github.com/Cratis/Arc.TypeScript/blob/main/Source/Chronicle/Integration/LiveArtifacts.ts), in the shape you would write it in your application:

```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { command, key } from '@cratis/arc.core';

@eventType()
export class TaskCreated { @field(String) title = ''; }

@command()
export class CreateTask {
    @field(String) @key() id = '';
    @field(String) title = '';

    handle(): TaskCreated {
        return Object.assign(new TaskCreated(), { title: this.title });
    }
}
```

With Chronicle [registered](../add-event-sourcing.md), `POST /api/create-task` appends one `TaskCreated` to the event source named by the command's `@key()` field, in the tenant's namespace. The command result carries no `response`, because the event was consumed on the server.

## What is appended

| `handle()` returns | Result |
| --- | --- |
| A registered event | Appended to the command's event source |
| An array of registered events | Appended in one SDK batch |
| An array of ordinary objects | An ordinary response, not events |
| `tuple(event, 'message')` | The event is appended to the command key, and `'message'` is the response |
| `tuple(eventSourceIdResponse(id), event)` | The event is appended to `id`, and `id` is returned to the caller |
| `eventForEventSourceId({ eventSourceId, event, ... })` | Appended to that event source with explicit routing |
| `eventsWithConcurrencyScopes(events, scopes)` | Appended with exact concurrency scopes; see [Concurrency](concurrency.md) |

The integration is a [response value handler](../../commands/response-value-handlers.md): it recognizes registered event instances and branded values, and everything else keeps its ordinary meaning. Returning Chronicle events together with [command operations](../../commands/operations/index.md) is rejected before either effect runs.

The event source, routing decorators, and explicit targets are covered in [Resolving the event source ID](../resolving-event-source-id.md).

## Low-level definitions

The older `defineChronicleCommand` remains. It takes a client, an event store, a tenant namespace resolver, and `produce()` returning `{ events, response }`, and appends immediately with its own rejection mapping. Use the model-bound path for new commands. Neither route makes the SDK's observer completion synchronous with an append acknowledgment.

## Related

- [Transactional commands](transactional-commands.md)
- [Testing Chronicle commands](../../testing/chronicle.md)

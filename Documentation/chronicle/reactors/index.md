---
title: Reactors
description: React to a recorded Chronicle event with a reactor, return follow-up events or Arc commands from it, and know how handlers are found and what a failure does.
---

After an author registers, the catalog should build a shelf for them. The registration command should not do that work itself: the shelf belongs to another slice, and the registration is complete the moment the fact is recorded. A projection answers "what does this look like now?". A **reactor** answers "what should happen because of this?".

Reactors are part of the Chronicle SDK, `@cratis/chronicle`. The Arc integration adds one thing to them: a reactor can return Arc commands, and Arc runs them through its command pipeline. See [Returning commands from a reactor](command-side-effects.md).

## Write a reactor

```typescript title="ShelfBuilder.ts"
import { reactor } from '@cratis/chronicle/reactors';
import type { EventContext } from '@cratis/chronicle/events';
import { AuthorRegistered } from '../Registration/Registration.js';
import { CreateShelf } from './CreateShelf.js';

@reactor()
export class ShelfBuilder {
    authorRegistered(event: AuthorRegistered, context: EventContext): CreateShelf {
        return new CreateShelf(context.eventSourceId);
    }
}
```

`CreateShelf` is an ordinary Arc `@command()` in your application. Register the reactor the way you register every other artifact, with `builder.add(...)` or `builder.discover(...)` after [`withChronicle`](../add-event-sourcing.md). The Arc-owned Chronicle client starts observing it when the application builds.

## How a handler is found

The SDK looks for a method named after the event class in camelCase: `AuthorRegistered` is handled by `authorRegistered`. The parameter type plays no part in the match.

:::caution[A misspelled handler is silently ignored]
A method whose name does not match an event class is never called, and nothing reports it. Rename the event class and the handler stops running. Check the method name first when a reactor appears to do nothing.
:::

The first argument is the stored event content parsed from JSON, not an instance of your event class. Read its properties, but do not call its methods or test it with `instanceof`. A concept property arrives as its underlying primitive value, so `event.name` on `AuthorRegistered` is a string at runtime even though the class declares an `AuthorName`. The second argument is the event's `EventContext`, which carries the event source ID, sequence number, occurred time, correlation ID, causation, and the identity that caused it.

The SDK constructs the reactor itself. It has no dependency injection, so a reactor cannot take constructor services.

## What a handler can return

| Return | What happens |
| --- | --- |
| Nothing | The event is acknowledged |
| A registered event, or an array of them | The SDK appends them to the triggering event's source and stream as one batch |
| An `EventForEventSourceId` entry, or an array mixing entries and events | The SDK appends each entry to its own target |
| An Arc `@command()` instance, or a nonempty array of only commands | Arc executes each command in order; see [Returning commands](command-side-effects.md) |

Returning commands and events together in one array fails the handler. Anything else the SDK does not recognize is ignored.

## When a handler fails

A handler that throws, or a returned side effect that fails, marks the observer partition for that event source as failed, with the error message. Chronicle's failed-partition handling decides when that event is delivered again. Nothing that already happened is undone, so write handlers that are safe to run twice for the same event.

The TypeScript SDK has no counterpart of .NET's `[OnceOnly]` replay exclusion. Treat every delivery as one that may be repeated.

## Topics

| Topic | Description |
| --- | --- |
| [Returning commands](command-side-effects.md) | Return Arc commands from a reactor and have Arc execute them with validation and authorization |
| [Chronicle reactors](/chronicle/reactors/) | Reactor concepts in the Chronicle documentation |

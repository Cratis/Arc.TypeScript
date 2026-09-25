---
title: Chronicle code analysis
description: Which of Arc on .NET's ARCCHR diagnostics for the Chronicle integration apply to TypeScript, which mistakes the runtime catches instead, and which have no check.
---

Arc on .NET ships Roslyn analyzers, `ARCCHR0001` to `ARCCHR0010`, that catch Chronicle integration mistakes at build time. `@cratis/eslint-plugin-arc-core` has **no** Chronicle rules. Some of those mistakes cannot happen in the TypeScript API, some are caught when the application builds or runs, and some have no check at all. This page says which is which, so you know what to watch for in review.

The Arc rules that do exist are listed in [Code analysis](../code-analysis/index.md).

## ARCCHR mapping

| .NET diagnostic | TypeScript status | Reason |
| --- | --- | --- |
| ARCCHR0001, aggregate handler signature | N/A | Handlers are registered with `this.on(EventClass, handler)`. The compiler checks the callback type, and a second handler for one event type throws. There is no method-name convention to get wrong. |
| ARCCHR0002, ambiguous command identity | N/A | A command has one key: `getEventSourceId()`, then `getKey()` or the single `@key()` field. Marking a second `@key()` throws when the class is defined. |
| ARCCHR0003, reactor reaches the event log | Not checked | A reactor that appends through its own SDK client does so outside the side-effect path. Return events instead; see [Reactors](reactors/index.md). |
| ARCCHR0004, `[EventType]` repeats the type name | N/A | The SDK falls back to the class name, which a bundler may rename. An explicit ID equal to the class name keeps the stored type stable, so it is not redundant here. |
| ARCCHR0005, Chronicle used but not registered | Partly caught at runtime | A `commandReadModel(Type)` binding with no owner fails `build()`. A returned event without `withChronicle` is not caught: nothing recognizes it, so it becomes the command's ordinary response, and nothing is appended. |
| ARCCHR0006, manual reactor command without `[OnceOnly]` | N/A | The TypeScript SDK has neither `[OnceOnly]` nor `[Replay]`. Every reactor handler must be safe to repeat; see [Returning commands from a reactor](reactors/command-side-effects.md#when-a-command-fails). |
| ARCCHR0007, command injects the event log | Not checked | A handler can reach `ChronicleReadModels.getStore().eventLog` and append immediately. Such an append is outside the command's batch; see [Transactional commands](commands/transactional-commands.md#what-is-outside-the-batch). |
| ARCCHR0008, data annotations `[Key]` | N/A | There is one `@key()`, from `@cratis/arc.core`, and Chronicle reads it. |
| ARCCHR0009, secret-looking command value | Handled at runtime, no lint rule | Values of fields whose names contain `password`, `secret`, `token`, `credential`, or `apiKey` are never recorded in the causation chain. Mark any other secret with `@notAudited()`; see [Causation and auditing](commands/causation.md). |
| ARCCHR0010, raw GUID response does not set the event source | Not checked | An ordinary value in a `tuple(...)` is the response, not the event source. Use `tuple(eventSourceIdResponse(id), event)` to set and return it; see [Resolving the event source ID](resolving-event-source-id.md#return-the-id-to-the-caller). |

## What to check in review

The unchecked rows are the ones a reviewer has to catch:

- a reactor or command that appends through the SDK instead of returning events;
- an application that returns events but never calls `withChronicle`, or calls it after registering artifacts;
- a command meant to append to an existing entity that returns an ID in a tuple instead of `eventSourceIdResponse`.

## Related

- [Code analysis](../code-analysis/index.md)
- [Chronicle](index.md)

---
title: Chronicle code analysis
description: Arc on .NET's Chronicle diagnostics mapped to TypeScript lint rules, runtime checks, and inapplicable C# patterns.
---

Arc on .NET v22.23.0 ships ten Chronicle analyzers (`ARCCHR0001`–`ARCCHR0010`).
Three have bounded TypeScript ESLint analogs in `@cratis/eslint-plugin-arc-core`.
Configure the plugin as described in [Code analysis](../code-analysis/index.md).
Both presets enable `arcchr0003` and `arcchr0007`.
`arcchr0010` needs type information and is enabled by `recommended-type-checked`.
ESLint reports enabled rules as errors, including analogs of .NET warnings.

## ARCCHR mapping

| .NET diagnostic | .NET default | TypeScript status |
| --- | --- | --- |
| ARCCHR0001, aggregate handler signature | Error | N/A |
| ARCCHR0002, ambiguous command identity | Warning | N/A / runtime |
| [ARCCHR0003](../code-analysis/ARCCHR0003.md), reactor reaches default log | Warning | ESLint analog |
| ARCCHR0004, redundant `[EventType]` id | Warning | N/A |
| ARCCHR0005, Chronicle used but not configured | Warning | Partly caught at runtime |
| ARCCHR0006, reactor executes a command without replay decision | Warning | Not checked |
| [ARCCHR0007](../code-analysis/ARCCHR0007.md), command injects event log | Warning | ESLint analog |
| ARCCHR0008, data annotations `[Key]` | Warning | N/A |
| ARCCHR0009, secret-looking command property | Warning | Runtime masking / no lint |
| [ARCCHR0010](../code-analysis/ARCCHR0010.md), raw GUID response | Warning | Type-checked ESLint analog |

- **ARCCHR0001:** `this.on(EventClass, handler)` registers a typed callback; duplicate handlers throw.
  No `On` method-signature convention exists.
- **ARCCHR0002:** `getEventSourceId()`, `getKey()`, or one `@key()` determines the key.
  A second `@key()` throws when the class is defined.
- **ARCCHR0003:** The rule finds direct `eventLog.append` or `appendMany` calls through a reactor's own store.
  It does not follow helper calls or stores obtained from another client. Return events instead.
- **ARCCHR0004:** An explicit TypeScript SDK ID equal to the class name stabilizes persisted type identity
  across minification or renaming. Removing it changes guarantees.
- **ARCCHR0005:** `commandReadModel(Type)` without an owner fails `build()`.
  A returned event without `withChronicle` becomes an ordinary response and is not caught.
  A per-file ESLint rule cannot prove registration in a separate host module.
- **ARCCHR0006:** TypeScript reactors normally return commands instead of calling .NET's `ICommandPipeline.Execute`.
  A returned command still needs an explicit replay policy. The SDK supports `@onceOnly()` and `@replay()`,
  but no lint rule proves command side effects across handler return types and replay handlers.
- **ARCCHR0007:** The rule finds direct `eventLog.append` or `appendMany` calls through a command's own store
  inside `handle()`, which bypasses returned-event batching. Indirect appends remain a review concern.
- **ARCCHR0008:** TypeScript has only Arc's `@key()`; there is no competing data-annotations decorator.
- **ARCCHR0009:** Arc withholds fields named `password`, `secret`, `token`, `credential`, or `apiKey`,
  and fields marked `@notAudited()` or `@pii()`. Unlike .NET's warning, claiming those names are written
  to causation would be false. Other sensitive names still need explicit markers.
- **ARCCHR0010:** A keyless command returning `tuple(Guid.parse(...), new DecoratedEvent())` returns
  an ordinary response instead of selecting the event source. The rule does not infer plain strings,
  indirect event factories, or other tuple shapes.

There is no ARCCHR analyzer for nullable event properties or past-tense event names in .NET v22.23.0;
this mapping does not add either rule.

## What to check in review

- Appends through helper methods or stores not held directly by a command or reactor can bypass the return-value pipeline.
- Reactors returning commands need a replay decision; `@onceOnly()` skips replay but does not prevent
  failed-partition re-delivery. See [Returning commands from a reactor](reactors/command-side-effects.md#when-a-command-fails).
- An app that returns events must install `withChronicle`; check the host, not just the artifact file.
- A tuple carrying an ordinary string instead of `eventSourceIdResponse(id)` does not select an event source;
  see [Resolving the event source ID](resolving-event-source-id.md#return-the-id-to-the-caller).

## Related

- [Code analysis](../code-analysis/index.md)
- [Chronicle](index.md)

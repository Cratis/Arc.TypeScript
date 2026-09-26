---
title: Chronicle code analysis
description: Arc on .NET's Chronicle diagnostics mapped to TypeScript lint rules, runtime checks, and inapplicable C# patterns.
---

Arc on .NET v22.23.0 ships ten Chronicle analyzers (`ARCCHR0001`–`ARCCHR0010`).
Four have bounded TypeScript ESLint analogs in `@cratis/eslint-plugin-arc-core`.
Configure the plugin as described in [Code analysis](../code-analysis/index.md).
Both presets enable `arcchr0003`, `arcchr0007`, and `arcchr0009`.
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
| ARCCHR0006, reactor executes a command without replay decision | Warning | Not implemented yet |
| [ARCCHR0007](../code-analysis/ARCCHR0007.md), command injects event log | Warning | ESLint analog |
| ARCCHR0008, data annotations `[Key]` | Warning | N/A |
| [ARCCHR0009](../code-analysis/ARCCHR0009.md), secret-looking command property | Warning | ESLint analog for names not masked at runtime |
| [ARCCHR0010](../code-analysis/ARCCHR0010.md), raw GUID response | Warning | Type-checked ESLint analog |

- **ARCCHR0001:** `this.on(EventClass, handler)` registers a typed callback; duplicate handlers throw.
  No `On` method-signature convention exists.
- **ARCCHR0002:** `getEventSourceId()`, `getKey()`, or one `@key()` determines the key.
  A second `@key()` throws when the class is defined.
- **ARCCHR0003:** The rule finds direct `eventLog.append` or `appendMany` calls through a `this` field
  initialized from `this.client.getEventStore` or `this.runtime.getStore`. It cannot prove the field's
  store belongs to the reactor; it ignores fields initialized from another client. Return events instead.
- **ARCCHR0004:** An explicit TypeScript SDK ID equal to the class name stabilizes persisted type identity
  across minification or renaming. Removing it changes guarantees.
- **ARCCHR0005:** `commandReadModel(Type)` without an owner fails `build()`.
  A returned event without `withChronicle` becomes an ordinary response and is not caught.
  A per-file ESLint rule cannot prove registration in a separate host module.
- **ARCCHR0006:** Not implemented yet. TypeScript reactors normally return commands instead of calling
  .NET's `ICommandPipeline.Execute`; a returned command still needs an explicit replay policy.
  The SDK supports `@onceOnly()` and `@replay()`, so a bounded lint rule is feasible.
- **ARCCHR0007:** The rule finds direct `eventLog.append` or `appendMany` calls from a command's
  `handle()` or `provide()` through an artifact store or a `@inject(ChronicleReadModels | ChronicleRuntime)`
  parameter, including local and inline `getStore()` calls. Indirect appends remain a review concern.
- **ARCCHR0008:** TypeScript has only Arc's `@key()`; there is no competing data-annotations decorator.
- **ARCCHR0009:** Arc withholds names containing `password`, `secret`, `token`, `credential`, or `apiKey`,
  and fields marked `@notAudited()` or `@pii()`. The rule checks the remaining .NET secret words,
  including Passphrase, PrivateKey, and AuthorizationHeader, without falsely claiming masked names
  are written to causation.
- **ARCCHR0010:** A keyless command returning `tuple(Guid.create(), new DecoratedEvent())` returns
  an ordinary response instead of selecting the event source. The type-checked rule also recognizes
  Guid variables and `Guid.parse(...)`; it does not infer plain strings, indirect event factories,
  inherited event-type decorators, or other tuple shapes.

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

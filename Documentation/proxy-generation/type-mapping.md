---
title: Type mapping
description: Which TypeScript declarations the proxy generator recognizes, which client types they become, and which shapes fail with a diagnostic.
---

The generator reads your source, not your running server, so it only knows what the declarations say. This page lists what it recognizes and what becomes of each type in the generated client.

## What is scanned

The generator shares Arc's discovery walk: only exported classes under `--artifacts` are considered, and `index.ts`, `given/`, `dist/`, `node_modules/`, `for_*/`, and symbolic links are skipped. Decorators and Fundamentals types are recognized by resolved symbol and declaring package, not by how you spell the import path.

## Types

| Server declaration | Generated client type |
| --- | --- |
| `String`, `Number`, `Boolean` fields | `string`, `number`, `boolean` |
| `Date` | `Date` |
| Fundamentals `Guid`, `DateOnly`, `TimeOnly`, `TimeSpan` | The same Fundamentals types |
| `ConceptAs<T>` | Its underlying type; `TaskId extends ConceptAs<Guid>` becomes `Guid` |
| Decorated model classes | Generated model classes, or interfaces with `--emit-interfaces` |
| Arrays | Arrays of the element type |
| String and number enums, string-literal unions | Enums and unions |
| Fundamentals `@derivedType('id')` classes and their declared bases | Emitted when found under the artifacts root, with the same `@derivedType` declaration |

## Return types

| Query or command returns | Generated as |
| --- | --- |
| A value, or `Promise<T>` | The value type |
| `QueryPage<T>` | A paged query of `T` |
| RxJS `Observable<T>`, `Subject<T>`, `BehaviorSubject<T>`, `ReplaySubject<T>`, `ObservableSource<T>`, or `AsyncIterable<T>` | An observable query of `T`; RxJS types must resolve to symbols declared by the `rxjs` package |
| An array | An enumerable result; the generator emits the array generic that matches the runtime constructor |
| A command returning a Chronicle `@eventType()` value or array, `eventForEventSourceId(...)`, `EventsWithConcurrencyScopes`, `AggregateRootCommitResult`, or Arc `CommandOperation(s)` | No client response (`Command<ICommand>`); these values are consumed on the server |
| A command returning `eventSourceIdResponse(id)` | The id value type (currently `string`); the Chronicle handler replaces the wrapper with the id when appending events |
| A command returning `tuple(...)` / `ArcTuple` | The single non-handled element, or no response if all elements are handled; multiple non-handled elements fail generation |
| A command returning `Promise<T>` or a union of handled and one visible type | Unwrap the promise and select the visible type |

## Field behavior

`@optional()`, `@nullable()`, `@defaultValue()`, and `@enumeration()` decide how a field is generated. A required nullable field is `T | null`; sending an explicit `null` command field with the published client has not been verified end to end. An undecorated `?` cannot make a server-required field optional and fails with a diagnostic.

Query arguments need explicit `@query(argument(...))` descriptors. Standard-mode `@inject()` and a bare `@query()` still need explicit tokens and descriptors.

## Diagnostics

An unsupported result type, multiple unhandled tuple values, ambiguous visible union alternatives, a bare array of command operations, or an unbound query parameter fails with a file and line location instead of falling back to `any`. Event detection resolves Chronicle's decorator symbol, so a locally defined decorator named `eventType` does not make a class server-handled. Ordinary arrays are not tuples; only arrays entirely of decorated events are omitted. Model identities include namespace and class name; the generator emits same-named models from different folders to their respective namespace folders. Two models that resolve to the same namespace and name still fail with `Ambiguous model name`. Import aliases for two different models with the same class name in one generated file are not supported.

## Related

- [Concepts](../concepts.md) for the server-side wire types
- [Validation rules](validation.md)

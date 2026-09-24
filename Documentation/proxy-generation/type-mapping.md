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
| `ObservableSource<T>` or `AsyncIterable<T>` | An observable query of `T` |
| An array | An enumerable result; the generator emits the array generic that matches the runtime constructor |

## Field behavior

`@optional()`, `@nullable()`, `@defaultValue()`, and `@enumeration()` decide how a field is generated. A required nullable field is `T | null`; sending an explicit `null` command field with the published client has not been verified end to end. An undecorated `?` cannot make a server-required field optional and fails with a diagnostic.

Query arguments need explicit `@query(argument(...))` descriptors. Standard-mode `@inject()` and a bare `@query()` still need explicit tokens and descriptors.

## Diagnostics

An unsupported result type, an unbound query parameter, or an ambiguous model name fails with a file and line location instead of falling back to `any`. Two reachable models with the same class name in different namespaces fail with `Ambiguous model name`; namespace-qualified model keys are not supported yet.

## Related

- [Concepts](../concepts.md) for the server-side wire types
- [Validation rules](validation.md)

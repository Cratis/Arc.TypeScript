---
title: Analyze Arc server artifacts
description: ESLint 10 rules for model-bound Arc commands, queries, and validators.
---

Use `@cratis/eslint-plugin-arc-core` to find model-bound binding mistakes before you build or start an Arc server. This is an unpublished source preview; it does not lint the existing Arc frontend packages. The existing `@cratis/eslint-plugin-arc` name belongs to the frontend repository.

Configure ESLint 10 with type information for the binding rules:

```js
import arc from '@cratis/eslint-plugin-arc-core';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    ...tseslint.configs.recommended,
    { files: ['src/**/*.ts'], languageOptions: { parserOptions: { projectService: true } } },
    arc.configs.recommended
);
```

Run `eslint src`. The recommended config includes every rule listed below. Rules only recognize decorators spelled as direct identifiers (such as `@command()`); aliased imports and custom wrappers are outside this preview. Type-checked rules need `parserOptions.projectService` or a TypeScript program; they do not guess from untyped syntax. Runtime and proxy-generator checks remain authoritative.

## ARC diagnostic mapping

The .NET IDs are retained only when the same mistake can happen in the TypeScript API. The columns distinguish a behavior analog from a verbatim Roslyn rule.

| .NET diagnostic | TypeScript status | Reason |
| --- | --- | --- |
| ARC0001 | N/A | TypeScript queries intentionally permit arbitrary result shapes; they do not enforce a read-model return type. |
| [ARC0002](ARC0002.md) | Analog | `handle()` without `@command()` is not discovered. |
| [ARC0003](ARC0003.md) | Analog | External `handle(command: DecoratedCommand)` methods do not run as command handlers. |
| [ARC0004](ARC0004.md) | Analog | A command must define a public instance `handle()`. |
| [ARC0005](ARC0005.md) | Analog | A direct `provide()` value with no handler parameters is discarded; this rule does not infer control outcomes or nested returns. |
| ARC0006 | N/A | Command-scoped read-model injection is not implemented. |
| ARC0007–ARC0009 | N/A | TypeScript has classes, not C# records; Concepts are classes extending `ConceptAs`. |
| [ARC0010](ARC0010.md) | Analog | Async `handle()` with no await unnecessarily wraps a synchronous result. |
| ARC0011 | N/A | TypeScript does not have `nameof`; roles are strings. |
| [ARC0012](ARC0012.md) | Analog | Built-in errors from decorated artifacts obscure domain failures. |
| [ARC0013](ARC0013.md) | Analog | Dereferencing a concept in `ruleFor` may throw before validation. |
| [ARC0014](ARC0014.md) | Analog | HTTP cannot supply generic type arguments to `@query`. |
| [ARC0015](ARC0015.md) | Analog | Primitive parameter converted to `ConceptAs` in a command handler or query skips concept validation. |
| ARC0016–ARC0018 | N/A | TypeScript operations are explicit returned `CommandOperation` objects, not C# annotated methods or generated invokers. |
| [ARC0019](ARC0019.md) | Analog | `@allowAnonymous()` conflicts with `@authorize()` or `@roles()` on one declaration. |
| ARC0020–ARC0021 | N/A | ASP.NET Core attributes and authentication schemes do not exist in this Node host. |

TypeScript-only rules: [missing-field](missing-field.md), [declared-field](declared-field.md), [inject-binding](inject-binding.md), [query-binding](query-binding.md), [misplaced-decorator](misplaced-decorator.md), [unexported-artifact](unexported-artifact.md), and [validator-target](validator-target.md). No automatic fix is offered: .NET's `Task` unwrap fix changes async rejection semantics in JavaScript; its `nameof` fix has no TypeScript equivalent. Manual fixes are shown on each page.

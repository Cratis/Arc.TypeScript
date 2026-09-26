---
title: Analyze Arc server artifacts
description: ESLint 10 rules for model-bound Arc commands, queries, and validators.
---

Use `@cratis/eslint-plugin-arc-core` to find model-bound binding mistakes before you build or start an Arc server. This is a publishable 0.x source preview (not yet published); it does not lint the existing Arc frontend packages. The existing `@cratis/eslint-plugin-arc` name belongs to the frontend repository.

Configure ESLint 10 with `typescript-eslint` (which installs `@typescript-eslint/parser`) and type information for the binding rules:

```js
import arc from '@cratis/eslint-plugin-arc-core';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    ...tseslint.configs.recommended,
    arc.configs['recommended-type-checked']
);
```

Run `eslint src`. Both presets enable the mapped ARC diagnostics, three Chronicle rules, and TypeScript-only rules below, except the opt-in name rule. `recommended` works without type information: type-dependent comparisons are skipped, while syntax checks still run. `recommended-type-checked` enables `parserOptions.projectService` to check parameter and token types and adds `arcchr0010`; files without an applicable tsconfig must be excluded or added to the project service. Both presets require a TypeScript parser. Arc decorators must resolve to imports from `@cratis/arc.core`, and `@field` must come from `@cratis/fundamentals` (including aliases and namespace imports); custom wrappers are not recognized. Runtime and proxy-generator checks remain authoritative.

## ARC diagnostic mapping

The .NET IDs are retained only when the same mistake can happen in the TypeScript API. The columns distinguish a behavior analog from a verbatim Roslyn rule.

| .NET diagnostic | TypeScript status | Reason |
| --- | --- | --- |
| ARC0001 | N/A | TypeScript queries intentionally permit arbitrary result shapes; they do not enforce a read-model return type. |
| [ARC0002](ARC0002.md) | Analog | A class with public fields and an instance `handle()` may be an undecorated command. |
| [ARC0003](ARC0003.md) | Analog | External `handle(command: DecoratedCommand)` methods do not run as command handlers. |
| [ARC0004](ARC0004.md) | Analog | A command needs an instance `handle()` (including inherited handlers); TypeScript private is runtime-callable. |
| [ARC0005](ARC0005.md) | Analog | A direct `provide()` value with no handler parameters is discarded; this rule does not infer control outcomes or nested returns. |
| ARC0006 | N/A | `commandReadModel(Type)` rejects a missing model unless you pass `{ optional: true }`, so the choice is already explicit in the declaration. |
| ARC0007–ARC0009 | N/A | TypeScript has classes, not C# records; Concepts are classes extending `ConceptAs`. |
| [ARC0010](ARC0010.md) | Analog | Async `handle()` without await, for-await, or a returned value wraps a synchronous result. |
| ARC0011 | N/A | TypeScript does not have `nameof`; roles are strings. |
| [ARC0012](ARC0012.md) | Analog | Built-in errors from decorated artifacts obscure domain failures. |
| [ARC0013](ARC0013.md) | N/A | Arc captures `ruleFor` paths using a Proxy, does not invoke selectors on input, walks paths null-safely, and unwraps concepts automatically. |
| [ARC0014](ARC0014.md) | Analog | HTTP cannot supply generic type arguments to `@query`. |
| [ARC0015](ARC0015.md) | Analog | Primitive query parameter converted to `ConceptAs` inside a query skips concept validation; command handler parameters are service or provided values, not wire inputs. |
| ARC0016–ARC0018 | N/A | TypeScript operations are explicit returned `CommandOperation` objects, not C# annotated methods or generated invokers. |
| [ARC0019](ARC0019.md) | Analog | `@allowAnonymous()` conflicts with `@authorize()` or `@roles()` on one declaration. |
| ARC0020–ARC0021 | N/A | ASP.NET Core attributes and authentication schemes do not exist in this Node host. |

Chronicle analogs: [ARCCHR0003](ARCCHR0003.md), [ARCCHR0007](ARCCHR0007.md), [ARCCHR0009](ARCCHR0009.md), and type-checked [ARCCHR0010](ARCCHR0010.md). See [Chronicle code analysis](../chronicle/code-analysis.md) for the complete .NET ARCCHR mapping, including diagnostics without TypeScript equivalents.

TypeScript-only rules: [missing-field](missing-field.md), [declared-field](declared-field.md), [inject-binding](inject-binding.md), [query-binding](query-binding.md), [query-argument-name](query-argument-name.md) (opt-in), [misplaced-decorator](misplaced-decorator.md), [unexported-artifact](unexported-artifact.md), and [validator-target](validator-target.md). No automatic fix is offered: .NET's `Task` unwrap fix changes async rejection semantics in JavaScript; its `nameof` fix has no TypeScript equivalent. Manual fixes are shown on each page.

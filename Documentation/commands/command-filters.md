---
title: Command filters
description: Validate low-level defineCommand and defineQuery definitions with validate callbacks and shared filters, and keep Zod schemas for shape only.
---

Low-level definitions made with `defineCommand` and `defineQuery` do not use validator classes. They take a `validate` callback and a list of `filters`, which run in the same pipeline stage as model-bound validators. Use a filter when one rule applies to many low-level operations: you write it once and list it on each definition that needs it.

:::caution[Filters apply only to low-level definitions]
A filter runs only for the `defineCommand` or `defineQuery` definitions that list it. There is no global filter that runs for every command, and `@command()` classes cannot take filters at all. This differs from Arc on .NET, where an `ICommandFilter` runs for every model-bound command. See [Cross-cutting rules for model-bound commands](#cross-cutting-rules-for-model-bound-commands) for what to use instead.
:::

## Validate and share a filter

```typescript title="tasks.ts"
import { defineCommand, validation, type CommandFilter } from '@cratis/arc.core';
import { z } from 'zod';

const shortTitle: CommandFilter<{ title: string }> = ({ title }) =>
    title.length <= 200 ? [] : [validation('A title can have at most 200 characters', ['title'])];

export const rename = defineCommand({
    name: 'Rename',
    namespace: 'Tasks',
    schema: z.object({ id: z.string(), title: z.string() }),
    validate: ({ title }) => title.trim() ? [] : [validation('A title is required', ['title'])],
    filters: [shortTitle],
    handle: ({ id, title }) => ({ id, title })
});
```

`validate` runs first, then each filter in order. Every one of them runs, and their results are returned together. A validator or filter may return an array, nothing, or a promise of either. For queries, the filter type is `QueryFilter`.

`validation(message, members?, reason?, severity?)` defaults to no members, the reason `rule`, and `Severity.Error`.

## Keep the schema for shape

A Zod schema failure produces exactly one result with reason `malformedRequest`, no message a user can act on, and no members. That includes Zod refinements such as `z.string().min(3)`. If a client should show "A title is required" next to the title field, return it from `validate` or a filter.

:::caution[Schemas must convert to JSON Schema]
Arc converts every schema to JSON Schema at startup. Types without a JSON representation, such as `z.date()` and `.transform(...)`, make startup throw. Send dates as ISO strings with `z.iso.datetime()` and convert them in the handler.
:::

## When a filter throws

The caller gets 400 with one result: reason `validatorFailed`, message `Validation failed`, and no members. The exception text is never sent; the original error goes to the `logger` option. When the request was already cancelled, the failure is reported as an exception instead.

## Cross-cutting rules for model-bound commands

When a rule should apply to many `@command()` classes, pick the mechanism by what the rule is about:

| The rule is about | Use | Runs on `/validate` |
| --- | --- | --- |
| Who may call a group of commands | A named policy with `builder.addAuthorizationPolicy(name, policy)` and `@authorize({ policy: name })` on each command; see [Authorization policies](../core/authorization.md) | Yes |
| A value that appears in many commands | A [concept validator](../concepts.md#validate-a-concept-everywhere), which runs wherever the concept is a field | Yes |
| One command's input | A [`CommandValidator`](command-validation.md) per command | Yes |
| Wrapping every command's execution, such as ambient state or timing | `builder.addCommandExecutionRunner(...)`; see [Command execution scopes](command-execution-scopes.md) | No; it runs only after validation passes |

Each of these is opted into per command or per value, except the execution runner, which runs for every validated command. Nothing runs a validation rule for every command automatically, so a new command is not covered by a rule you wrote for the others until you declare it.

## Related

- [Low-level definitions](low-level-definitions.md)
- [Command validation](command-validation.md) for model-bound validators
- [Command pipeline](command-pipeline.md)

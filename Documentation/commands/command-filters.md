---
title: Command filters
description: Validate low-level defineCommand and defineQuery definitions with validate callbacks and shared filters, and keep Zod schemas for shape only.
---

Low-level definitions made with `defineCommand` and `defineQuery` do not use validator classes. They take a `validate` callback and a list of `filters`, which run in the same pipeline stage as model-bound validators. Use a filter when one rule applies to many operations.

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

## Related

- [Low-level definitions](low-level-definitions.md)
- [Command validation](command-validation.md) for model-bound validators
- [Command pipeline](command-pipeline.md)

---
title: Concepts
description: Wrap domain values in ConceptAs types, declare them and other wire types on model-bound fields, and validate a concept wherever it appears.
---

A task ID should not look like every other string to a handler, and a title rule should not be copied into every command that takes a title. A **concept** is a small class that wraps one primitive domain value. Arc decodes it from the wire, hands your code the concept, encodes it back to the primitive, and runs its validator wherever it appears.

## Declare a concept

The [Tasks sample identifier](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/TaskId.ts) wraps a Fundamentals `Guid`:

```typescript
import { ConceptAs, Guid } from '@cratis/fundamentals';

export class TaskId extends ConceptAs<Guid> {
    static readonly valueType = Guid;
    static create(): TaskId { return new TaskId(Guid.create()); }
}
```

Use it on a field: `@field(TaskId) id!: TaskId`. The static `valueType` is required because TypeScript erases generic arguments at runtime. Incoming UUID strings become `TaskId` instances holding a `Guid`; responses convert them back to strings. The sample's [`TaskTitle`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/TaskTitle.ts) wraps a `String` the same way.

An invalid UUID fails binding with a 400 `malformedRequest` result. Empty strings and falsy numbers and booleans are preserved, not treated as absent.

## Wire types

| Declaration | Wire value |
| --- | --- |
| `@field(String)`, `@field(Number)`, `@field(Boolean)` | JSON string, number, boolean |
| `@field(Date)` | ISO timestamp string |
| `@field(Guid)` | UUID string |
| `@field(DateOnly)`, `@field(TimeOnly)`, `@field(TimeSpan)` | Fundamentals date, time, and duration strings |
| `@field(SomeConcept)` | The concept's underlying primitive |
| `@field(NestedModel)` | A JSON object built from the nested class's own `@field` declarations |
| `@field(Array, { genericArguments: [TaskItem] })` | A JSON array of that element type; the older `@field(TaskItem, true)` form also works |

`Guid`, `DateOnly`, `TimeOnly`, and `TimeSpan` come from `@cratis/fundamentals`. Arc uses its own field metadata to decode these types, not Fundamentals' `JsonSerializer`, and one schema drives decoding, [introspection](introspection/index.md), and [OpenAPI](open-api/index.md). The finer wire rules, including polymorphic fields and naming, are in the [wire format reference](reference/wire-format.md).

## Required, optional, and enumerations

Every field is required unless you mark it:

| Decorator | Meaning |
| --- | --- |
| `@optional()` | The field may be omitted |
| `@nullable()` | The field may be `null` |
| `@defaultValue(value)` | Omitted input takes this value |
| `@enumeration(Priority)` | The scalar value must be a member of this enum object |

A TypeScript enum is not a constructor that `@field` accepts. Pair `@enumeration(Priority)` with `@field(String)` or `@field(Number)`. Arc ignores the reverse-mapping names of numeric enums and rejects enum values whose type does not match the declared scalar field.

## Validate a concept everywhere

A rule that belongs to the value goes on the concept, once. The [sample title validator](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/TaskTitleValidator.ts):

```typescript
import { ConceptValidator, validator } from '@cratis/arc.core';
import { TaskTitle } from './TaskTitle.js';

@validator(TaskTitle)
export class TaskTitleValidator extends ConceptValidator<TaskTitle> {
    constructor() {
        super();
        this.ruleFor(title => title.value).must(value => !value.startsWith('!'))
            .withMessage('A title cannot begin with an exclamation mark');
    }
}
```

Arc traverses the declared `@field` members of commands, query arguments, and nested models, and runs the concept validator on every `TaskTitle` it meets, including inside arrays. A failure inside `entries[]` reports `entries.title`, not an array index. The owning model's own rules still run independently.

To skip only the *direct* member's concept validator, call `.ignoreConceptRules()` on the owner's `ruleFor(...)` chain; descendants are still traversed. `ModelValidator<T>` validates a nested model class the same way wherever it appears.

## Related

- [Command validation](commands/command-validation.md)
- [Wire format reference](reference/wire-format.md)
- [Troubleshooting](troubleshooting.md) for decorator and module-resolution settings

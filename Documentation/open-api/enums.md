---
title: Enums in the document
description: Restrict a number or string field to an enum's values with @enumeration, and see how numeric and string enums are described in /openapi.json exactly as they travel on the wire.
---

A client generator needs to know that `priority` accepts only a few values, and which ones. Arc lists the enum's values in the schema, the same values the wire carries, so a client that follows the document sends valid input.

## Declare the field

A TypeScript enum is not a runtime type that `@field` accepts. Declare the scalar with `@field(Number)` or `@field(String)`, and restrict it with `@enumeration(Enum)`:

```typescript title="Features/Tasks/Prioritizing.ts"
import { field, ConceptAs, Guid } from '@cratis/fundamentals';
import { command, enumeration } from '@cratis/arc.core';

export class TaskId extends ConceptAs<Guid> { static readonly valueType = Guid; }
export enum Priority { Low, Normal, High }
export enum Status { Open = 'open', Done = 'done' }

@command({ namespace: 'Tasks' })
export class PrioritizeTask {
    @field(TaskId) id!: TaskId;
    @field(Number) @enumeration(Priority) priority!: Priority;
    @field(String) @enumeration(Status) status!: Status;
    handle(): void {}
}
```

The request body describes both fields as one `const` per member value:

```json
"priority": { "anyOf": [{ "type": "number", "const": 0 }, { "type": "number", "const": 1 }, { "type": "number", "const": 2 }] },
"status": { "anyOf": [{ "type": "string", "const": "open" }, { "type": "string", "const": "done" }] }
```

Without `@enumeration`, `priority` is described as any number and Arc accepts any number at runtime.

## Numeric and string enums

- A **numeric enum** such as `Priority` is described as the numbers `0`, `1`, and `2`. Arc ignores the reverse mappings TypeScript adds to numeric enums, so the names `Low`, `Normal`, and `High` do not appear.
- A **string enum** such as `Status` is described as its string values, `open` and `done`.

If your consumers need readable names, use a string enum: its values are what they see in the document and on the wire. [Wire format](../reference/wire-format.md) explains how numeric enums compare with .NET.

The values must match the declared scalar. `@field(String) @enumeration(Priority)` fails when Arc builds the schema, because `Priority` has number values.

## Difference from Arc on .NET

The enum transformer in Arc's ASP.NET Core OpenAPI integration lists member names under an `integer` type, while the .NET wire carries numbers. Arc for TypeScript describes the values it actually sends.

## Related

- [Concepts in the document](concepts.md)
- [How types appear in the document](schemas.md)

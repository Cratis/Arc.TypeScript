---
title: How types appear in the document
description: See how concepts, dates, enums, optional, nullable, and defaulted fields, and result types are described in /openapi.json and the introspection schemas, and why they match the wire format.
---

Your command declares `@field(TaskId) id`. A client generator in Go or Python must not see a `TaskId` object with a `value` inside it, because the JSON on the wire carries a plain UUID string. Arc builds every schema in the document from the same wire rules that bind and serialize requests, so what the document says is what the wire carries.

The same schemas appear in the [introspection](../introspection/index.md) endpoints: a command's `payloadSchema` in `/.cratis/commands` is identical to its OpenAPI request body schema.

## An example

This command uses concepts, enums, and each field modifier:

```typescript title="Features/Tasks/Planning.ts"
import { field, ConceptAs, Guid } from '@cratis/fundamentals';
import { command, defaultValue, enumeration, nullable, optional } from '@cratis/arc.core';

export class TaskId extends ConceptAs<Guid> { static readonly valueType = Guid; }
export class Estimate extends ConceptAs<number> { static readonly valueType = Number; }
export enum Priority { Low, Normal, High }
export enum Status { Open = 'open', Done = 'done' }

@command({ namespace: 'Tasks' })
export class PlanTask {
    @field(TaskId) id!: TaskId;
    @field(Estimate) estimate!: Estimate;
    @field(Number) @enumeration(Priority) priority!: Priority;
    @field(String) @enumeration(Status) status!: Status;
    @field(String) @optional() note?: string;
    @field(Date) @nullable() due!: Date | null;
    @field(Boolean) @defaultValue(false) urgent!: boolean;
    handle(): void {}
}
```

Its request body schema in `/openapi.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id": { "type": "string", "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", "format": "uuid" },
    "estimate": { "type": "number" },
    "priority": { "anyOf": [{ "type": "number", "const": 0 }, { "type": "number", "const": 1 }, { "type": "number", "const": 2 }] },
    "status": { "anyOf": [{ "type": "string", "const": "open" }, { "type": "string", "const": "done" }] },
    "note": { "type": "string" },
    "due": { "anyOf": [{ "type": "string", "format": "date-time" }, { "type": "null" }] },
    "urgent": { "default": false, "type": "boolean" }
  },
  "required": ["id", "estimate", "priority", "status", "due"]
}
```

The sections below explain each property.

## Concepts

A concept is described as the value it wraps. `TaskId` is a `ConceptAs<Guid>`, so `id` is a UUID string with a pattern; `Estimate` wraps a number, so `estimate` is a number. The concept's name does not appear anywhere in the document, because nothing on the wire carries it.

| Declared type | Schema |
| --- | --- |
| `String`, or a concept over it | `{ "type": "string" }` |
| `Number`, or a concept over it | `{ "type": "number" }` |
| `Boolean`, or a concept over it | `{ "type": "boolean" }` |
| `Guid`, or a concept over it | A string with `format: "uuid"` and a UUID pattern |
| `Date` | A string with `format: "date-time"` |
| `DateOnly` / `TimeOnly` | A string with `format: "date"` / `format: "time"` and a pattern |
| `TimeSpan` | A string with a .NET-style `[-][d.]hh:mm:ss[.fffffff]` pattern |
| A `@field` model class | An inline object schema of its fields |

Concept validators do not become schema constraints. A rule such as "at most 100 characters" is enforced by Arc when the request arrives, and returned as a validation result, but the schema only says `string`.

## Enums

A TypeScript enum is not a runtime type that `@field` accepts, so you declare the scalar with `@field(Number)` or `@field(String)` and restrict it with `@enumeration(Enum)`. The schema lists the enum's **values**, one `const` per member:

- A numeric enum such as `Priority` is described as the numbers `0`, `1`, and `2`. Arc ignores the reverse mappings TypeScript adds to numeric enums, so the names `Low`, `Normal`, and `High` do not appear.
- A string enum such as `Status` is described as its string values, `open` and `done`.

The wire carries the same values, so a client that follows the schema sends valid input. If your consumers need readable names, use a string enum: its values are the names they see in the document and on the wire. See [Wire format](../reference/wire-format.md) for how numeric enums and .NET compare.

Arc on .NET differs here: the enum transformer in its ASP.NET Core OpenAPI integration lists the member names under an `integer` type, while the wire carries numbers. Arc for TypeScript describes the values it actually sends.

## Optional, nullable, and default values

| Field | Schema | Required? |
| --- | --- | --- |
| `@field(String) note` | `string` | Yes |
| `@field(String) @optional() note` | `string` | No; the property may be left out |
| `@field(Date) @nullable() due` | `anyOf` the type and `null` | Yes; the property must be present, and may be `null` |
| `@field(Boolean) @defaultValue(false) urgent` | `boolean` with `default: false` | No; Arc fills in the default |

## Derived types

In input schemas, a field whose type has registered `@derivedType('id')` subclasses is described with `oneOf`, one variant per subclass, each carrying its `_derivedTypeId`. See [Wire format](../reference/wire-format.md) for the rules.

## Result types

Command responses and query data use the same rules, with two differences:

- They appear only when [generated artifact metadata](../proxy-generation/generated-artifact-metadata.md) declares the return type. Otherwise the envelope has no `response` or `data` property.
- They describe output, so a model's object schema sets `additionalProperties: false`. A query that may return nothing, such as the Tasks sample's `taskById` returning `TaskItem | undefined`, is described as `anyOf` the model and `null`.

## Related

- [OpenAPI](index.md)
- [Concepts](../concepts.md)
- [Command introspection](../introspection/commands.md)

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

The sections below explain each property. Concepts, enums, and result types have their own pages; this page covers the field modifiers and derived types that apply to all of them.

## Concepts

A concept is described as the value it wraps: `id` is a UUID string, and `estimate` is a number. The name `TaskId` appears nowhere, because nothing on the wire carries it. [Concepts in the document](concepts.md) has the table for every declared type, and explains why concept validators do not become schema constraints.

## Enums

`@enumeration(Enum)` lists the enum's values, one `const` per member: `priority` is `0`, `1`, or `2`, and `status` is `open` or `done`. [Enums in the document](enums.md) covers numeric and string enums and the difference from Arc on .NET.

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

Command responses and query data use the same rules, with two differences: they appear only when [generated artifact metadata](../proxy-generation/generated-artifact-metadata.md) declares the return type, and output object schemas set `additionalProperties: false`. See [Commands in the document](commands.md#the-typed-response) and [Queries in the document](queries.md#responses).

## Related

- [OpenAPI](index.md)
- [Model-bound and low-level operations](model-bound.md), for where each part of an operation comes from
- [Concepts](../concepts.md)
- [Command introspection](../introspection/commands.md)

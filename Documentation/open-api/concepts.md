---
title: Concepts in the document
description: See how ConceptAs values, GUIDs, dates, and field models are described in /openapi.json as the JSON value they carry on the wire, and why concept validators do not become schema constraints.
---

Your command declares `@field(TaskId) id`. A client generator in Go or Python must not see a `TaskId` object with a `value` inside it, because the JSON on the wire carries a plain UUID string. Arc describes every concept as the value it wraps, so the document matches what the client actually sends and receives.

## A concept becomes the value it wraps

The Tasks sample declares `TaskId` as a `ConceptAs<Guid>` and `TaskTitle` as a `ConceptAs<string>`. The `taskById` query takes a `TaskId` argument, and `/openapi.json` describes it as a UUID string:

```json
{
  "name": "id",
  "in": "query",
  "required": true,
  "schema": {
    "type": "string",
    "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
    "format": "uuid"
  }
}
```

The same rule applies wherever a concept appears: a command's request body, a query argument, a nested model field, a command `response`, or query `data`. The `registerTask` command returns a `TaskId`, so its 200 envelope describes `response` as the same UUID string. The concept's name never appears in the document, because nothing on the wire carries it.

A concept class needs `static readonly valueType`, because TypeScript erases the generic argument of `ConceptAs<T>`. Arc reads that marker to pick the schema, and rejects a concept without it; see [Concepts](../concepts.md).

## Declared types and their schemas

| Declared type | Schema |
| --- | --- |
| `String`, or a concept over it | `{ "type": "string" }` |
| `Number`, or a concept over it | `{ "type": "number" }` |
| `Boolean`, or a concept over it | `{ "type": "boolean" }` |
| `Guid`, or a concept over it | A string with `format: "uuid"` and a UUID pattern |
| `Date` | A string with `format: "date-time"` |
| `DateOnly` / `TimeOnly` | A string with `format: "date"` / `format: "time"` and a pattern |
| `TimeSpan` | A string with a .NET-style `[-][d.]hh:mm:ss[.fffffff]` pattern |
| `@field(Array, { genericArguments: [Element] })` | An array of the element's schema |
| A `@field` model class | An inline object schema of its fields |

These rules come from the wire schema in `Source/Core/reflection/wireSchema.ts`, the same code that validates incoming requests and serializes results.

Arc on .NET maps `int` and `long` concepts to `integer`. A JavaScript `number` has no integer type, so a numeric concept here is always `number`.

## Validators are not schema constraints

A concept validator, such as "at most 100 characters", does not become `maxLength` in the schema. Arc runs the validator when the request arrives and returns its failure as a validation result in the 400 envelope. The schema only says `string`.

Tell API consumers about those rules in your own documentation, or let them discover the rule from the validation result.

## Related

- [Concepts](../concepts.md) for declaring concepts and their validators
- [Enums](enums.md) for restricting a scalar to a set of values
- [How types appear in the document](schemas.md) for optional, nullable, defaulted, and derived fields

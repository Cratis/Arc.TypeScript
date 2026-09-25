---
title: Serializers
description: How MongoCollection maps decorated fields, concepts, GUIDs, dates, numbers, and derived types to BSON, what fails and why, and how to write through the driver without breaking the mapping.
---

A task ID is a `TaskId` concept in your code, a UUID binary in MongoDB, and a string on the wire. Getting each of those conversions right by hand, in every query and every write, is how documents written by one service become unreadable to another. `MongoCollection<T>` does it from the model's `@field` declarations: reads return instances of your model, and the stored documents match what Arc on .NET writes.

## Storage format

| Model value | Stored as |
| --- | --- |
| `@key()` field, or a field named `id` | `_id` |
| `Guid` | Standard UUID binary (subtype 4) |
| A concept | Its underlying value, stored by the same rules |
| `Date` | BSON date |
| `DateOnly` | BSON date at 12:00 UTC on that day |
| `TimeOnly` | BSON date on 1970-01-01, UTC |
| `TimeSpan` | String, such as `01:02:03.123` |
| `String`, `Number`, `Boolean` | As is |
| Nested decorated model | Embedded document, by the same rules |
| Array with `genericArguments` | Array, each element by the same rules |
| A class with Fundamentals `@derivedType('identifier')` | Its fields plus `_derivedTypeId` |

Property names come from the [naming policy](naming-policies.md). No global BSON conventions or class maps are installed, so other code using the same driver is unaffected.

## How reads map documents

`items.find(filter)`, `items.findById(id)`, `queryPage`, and `observe` all build model instances the same way:

- Only declared fields are read. A stored property with no matching `@field` is ignored.
- A declared field missing from the document stays unset on the instance.
- A concept field is rebuilt as an instance of the concept class.
- `Number` accepts BSON doubles and integers, and `Int64` or `Decimal128` values that a JavaScript number represents exactly. A value it cannot represent exactly, such as `Decimal128('0.123456789123456789')`, fails the read with a `RangeError` rather than rounding.
- For a base type with registered derivatives, `_derivedTypeId` selects the concrete class; GUID identifiers compare case-insensitively.

`findById` accepts a primitive, `Guid`, concept, `ObjectId`, or UUID binary, and rejects an object such as `{ $ne: null }` so a request value cannot become a query operator.

## When mapping fails

| Error | Cause |
| --- | --- |
| `MongoDB model <Type> requires @field metadata` | The model declares no fields |
| `MongoDB model <Type> declares multiple keys` | More than one `@key()` |
| `MongoDB model <Type> requires @key() or an id field` | No key |
| `MongoDB model <Type> is missing _id` | A stored document has no `_id` |
| `MongoDB Guid requires standard UUID binary` | A `Guid` field holds a string, or legacy UUID binary (subtype 3) |
| `MongoDB number cannot be represented exactly as a JavaScript number` | A lossy `Int64` or `Decimal128` |
| `MongoDB number must be finite` | A `Number` field holds something else |
| `Unknown MongoDB derived type: <id>` | A `_derivedTypeId` with no registered class |
| `Unsupported MongoDB model type: <Type>` | A field type the codec does not map, such as a class without `@field` declarations |

The first three fail when the collection is first resolved. The others fail the read, and the query answers with an error rather than a half-built model.

A `Guid` written by an older .NET driver configuration as legacy UUID binary is the most common of these. Migrate such documents to standard UUID representation before reading them here.

## Write through the driver

The collection has no insert or update methods of its own. Write through `items.native`, the driver collection, and encode with `items.codec` so the document matches what reads expect:

```typescript
import type { Document, Filter } from 'mongodb';

await items.native.insertOne(items.codec.serialize(task));
await items.native.replaceOne({ _id: items.codec.id(task.id) } as Filter<Document>, items.codec.serialize(task), { upsert: true });
```

`codec.id` returns `unknown`, so a filter built with it needs the `Filter<Document>` cast the package's own code uses.

`serialize` refuses an instance without a key value, so the driver never invents an `ObjectId` your model cannot read back. A plain object with the model's fields is encoded like an instance.

Reading through `native` returns raw driver documents. Pass them to `items.codec.deserialize(document)` to get a model instance.

## Existing documents in another shape

`ignoreConventions: true` bypasses the codec for collections that already store driver-native documents. Reads assign the raw document's properties to a new instance, writes store the instance's own properties, and identities pass through unchanged. In that mode you own field names and conversion, and a model does not need a key.

## Related

- [Naming policies](naming-policies.md)
- [Wire format reference](../reference/wire-format.md)

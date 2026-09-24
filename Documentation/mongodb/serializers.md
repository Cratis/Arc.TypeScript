---
title: Serializers
description: How MongoCollection maps decorated fields, concepts, GUIDs, dates, and derived types to BSON, and how to write through the underlying driver without breaking the mapping.
---

`MongoCollection<T>` reads and writes through a codec derived from the model's `@field` metadata. You get model instances back from reads, and documents stay compatible with what Arc on .NET stores.

## Storage format

| Model value | Stored as |
| --- | --- |
| `@key()` field, or a field named `id` | `_id` |
| `Guid` | Standard UUID binary (subtype 4) |
| A concept | Its underlying primitive |
| `Date` | BSON date |
| `DateOnly` | BSON date at UTC noon |
| `TimeOnly` | Milliseconds after the Unix epoch |
| `TimeSpan` | String |
| Nested decorated models and arrays | The same mapping, recursively |

A class annotated with Fundamentals `@derivedType('identifier')` writes `_derivedTypeId`; reading an unknown discriminator fails instead of creating a base model. No global BSON conventions are installed.

## Read and write

- `items.find(filter)` and `items.findById(id)` return model instances. `findById` rejects operator objects as identities.
- `items.codec` is the codec; `items.native` is the underlying `mongodb` driver collection.
- To write elsewhere in your application, encode first: `await items.native.insertOne(items.codec.serialize(task))`.
- Reading through `native` returns driver documents, not model instances.

## Existing documents

`ignoreConventions: true` bypasses the codec for collections that already store driver-native documents. In that mode, you own field names and conversion.

## Related

- [Naming policies](naming-policies.md)
- [Wire format reference](../reference/wire-format.md)

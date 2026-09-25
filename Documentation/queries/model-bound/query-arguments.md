---
title: Query arguments
description: Bind named, optional, typed, and repeated query arguments from the query string, and know which values Arc converts and which it rejects.
---

A search query takes tags, a limit, and a flag. You declare each argument once, with its wire type, and Arc binds it by name from the query string, or from a structured `QUERY` body.

## Declare arguments

```typescript title="Item.ts"
import { field } from '@cratis/fundamentals';
import { argument, query, readModel } from '@cratis/arc.core';

@readModel()
export class Item {
    @field(String) name!: string;

    @query(argument('tags', Array, { elementType: String }), argument('limit', Number, { optional: true }), argument('open', Boolean, { optional: true }))
    static search(tags: string[], limit: number | undefined, open: boolean | undefined): Item[] {
        return [{ name: `${tags.join('+')}:${limit}:${open}` }];
    }
}
```

`GET /api/search?tags=a&tags=b&limit=5&open=true` binds `tags: ['a', 'b']`, `limit: 5` as a number, and `open: true`. `GET /api/search?tags=a` leaves the optional arguments `undefined`.

| `argument(...)` form | Meaning |
| --- | --- |
| `argument('id', TaskId)` | A required argument decoded to the given wire type, here a concept |
| `argument('limit', Number, { optional: true })` | An optional argument; type the parameter `number \| undefined`, not `limit?: number` |
| `argument('ids', Array, { elementType: TaskId })` | A repeated GET key, each value decoded to the element type |

The wire types are the same as for fields; see [Concepts](../../concepts.md).

## GET binding rules

- Argument names match case-insensitively: `?Tags=a&LIMIT=2` binds `tags` and `limit`.
- An argument the query does not declare answers 400 `malformedRequest`.
- Numbers and booleans are converted from text. An invalid value, such as a malformed UUID for a `Guid` or concept argument, answers 400 `malformedRequest`.
- A key may repeat only for an array argument; a single value becomes a one-element array. Repeating any other key, or repeating a key with different casing, answers 400.
- `page`, `pageSize`, `sortBy`, and `sortDirection` are reserved for [paging and sorting](paging.md) and never reach your arguments.

For structured arguments, such as nested objects, use the [HTTP `QUERY` method](../using-the-http-query-method.md).

## Low-level queries

A `defineQuery` definition binds the same way against its Zod schema: a `z.number()` or `z.boolean()` property is converted from text, also through `.optional()`, `.default(...)`, and `.nullable()`, and a key may repeat only for a `z.array(...)` property. Other values stay strings.

## Related

- [Model-bound queries](index.md)
- [Query validation](../validation.md)

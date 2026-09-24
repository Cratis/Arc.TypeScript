---
title: Bind query arguments, page, and sort
description: Send query arguments with GET or QUERY, page and sort results in memory, and return a page that your data source has already cut.
---

A query receives its arguments from a URL or a JSON body, and a client often asks for one page of the result in a particular order. Arc for TypeScript binds the arguments to your Zod schema, and either pages and sorts the returned array itself or accepts a page your data source has already produced.

```typescript title="tasks.ts"
import { ArcServer, defineQuery, queryPage } from '@cratis/arc.server';
import { z } from 'zod';

interface Task { id: string; title: string; tags: string[] }
const stored: Task[] = [];

const byTags = defineQuery({
    name: 'ByTags',
    namespace: 'Tasks',
    schema: z.object({ tags: z.array(z.string()).default([]), limit: z.number().optional() }),
    perform: ({ tags, limit }) => stored
        .filter(task => tags.every(tag => task.tags.includes(tag)))
        .slice(0, limit ?? stored.length)
});

const recent = defineQuery({
    name: 'Recent',
    namespace: 'Tasks',
    schema: z.object({}),
    perform: (_input, _context, options) => {
        const page = options.paging?.page ?? 0;
        const size = options.paging?.pageSize ?? 0;
        const items = size ? stored.slice(page * size, (page + 1) * size) : stored;
        return queryPage(items, stored.length);
    }
});

export const arc = new ArcServer({ queries: [byTags, recent] });
```

`GET /api/tasks/by-tags?tags=urgent&tags=home&limit=5&pageSize=2` binds `{ tags: ['urgent', 'home'], limit: 5 }`, and Arc returns the first two items. `recent` pages itself and hands Arc the page and the total.

## Send arguments with GET

- Argument names match schema properties case-insensitively. An argument the schema does not declare answers 400 `malformedRequest`.
- A value for a `z.number()` or `z.boolean()` property is converted from text, also through any combination of `.optional()`, `.default(...)`, and `.nullable()`. Other values stay strings, so send structured arguments with `QUERY`.
- A key may repeat only for a property declared as `z.array(...)`, again through those wrappers. Each value is converted by the element type, and a single value becomes a one-element array. Repeating any other key, or repeating a key with different casing such as `tags` and `TAGS`, answers 400.
- `page`, `pageSize`, `sortBy`, and `sortDirection` are reserved for paging and sorting and never reach the schema.

## Send arguments with QUERY

The HTTP `QUERY` method takes a JSON body with at most three properties, and any other property answers 400:

```json
{ "arguments": { "tags": ["urgent"] }, "paging": { "page": 0, "pageSize": 10 }, "sorting": { "field": "title", "direction": "desc" } }
```

`arguments` is parsed by the schema as JSON, so numbers, booleans, arrays, and objects keep their types. Argument names match case-insensitively, as with GET. `paging` accepts only `page` and `pageSize`, and `sorting` only `field` and `direction`.

## Page and sort

| Request | Meaning |
| --- | --- |
| GET with `pageSize` of 1 or more | Page `page` (zero-based, default 0) of that size |
| GET with `pageSize` of 0, negative, or not an integer | 400 `malformedRequest` |
| `QUERY` with `pageSize` of 1 or more | Page `page` of that size |
| `QUERY` with `pageSize: 0`, or without `pageSize` | Unpaged |
| `sortBy` or `sorting.field` | Sort by that field. The name must start with a letter and contain only letters, digits, and `_`. |
| `sortDirection` or `sorting.direction` | `asc`, `ascending`, `desc`, or `descending`, in any case; `asc` by default. A direction without a field answers 400. |

When `perform` returns an array, Arc sorts it first and then pages it, and `paging` in the result reports `page`, `size`, `totalItems`, and `totalPages`. The sort field must be a property of every item, or the request answers 400. Dates compare by time, numbers and bigints numerically, `false` before `true`, and `null` or `undefined` before any value in ascending order. Other values compare as strings.

When `perform` returns something other than an array, a request that asks for paging or sorting answers 400.

## Return a page your data source cut

Loading every row to page it in memory does not scale. When a database pages for you, return `queryPage(items, totalItems)` from `perform`, as `recent` does. Arc uses the items as they are, without slicing them again, and reports your total:

- `items` must be exactly the requested page: the page size, or fewer on the last page. For an unpaged request, `items` must hold all `totalItems`. Anything else answers 400.
- A request that asks for sorting answers 400, because Arc cannot sort a page it did not cut. Sort in the data source instead.
- `queryPage` itself throws when `totalItems` is negative, not a safe integer, or smaller than the number of items. The query then fails with a 500.

The optional [MongoDB integration](mongodb.md) returns such a page from `MongoReadModels.queryPage`.

## Related

- [Validate and authorize commands and queries](validation-and-authorization.md)
- [Call Arc from code](direct-calls.md), where `performQuery` takes the same paging and sorting options
- [Arc HTTP contract](/arc/http-contract/)

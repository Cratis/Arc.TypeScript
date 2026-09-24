---
title: Paging and sorting
description: Page and sort array results in memory, receive paging options in a query, and return a page your data source has already cut with queryPage.
---

A client rarely wants every row. It asks for one page, in an order. Arc handles that for array results without any code from you, and lets a query that talks to a database cut the page itself.

## Page and sort arrays automatically

When a query returns an array, Arc sorts it, then pages it:

```typescript
import { field } from '@cratis/fundamentals';
import { query, queryOptions, queryPage, readModel, service, type QueryOptions } from '@cratis/arc.core';

export class Catalog {
    readonly items = [{ name: 'Apple' }, { name: 'Pear' }, { name: 'Fig' }];
}

@readModel()
export class Product {
    @field(String) name!: string;

    @query(service(Catalog))
    static all(catalog: Catalog): Product[] { return catalog.items; }

    @query(service(Catalog), queryOptions())
    static recent(catalog: Catalog, options: QueryOptions) {
        const page = options.paging?.page ?? 0;
        const size = options.paging?.pageSize ?? 0;
        const items = size ? catalog.items.slice(page * size, (page + 1) * size) : catalog.items;
        return queryPage(items, catalog.items.length);
    }
}
```

With `Catalog` registered as a singleton, `GET /api/all?pageSize=2&sortBy=name&sortDirection=desc` returns `Pear` and `Fig`, with `paging` reporting `{"page":0,"size":2,"totalItems":3,"totalPages":2}`.

## Request parameters

| Request | Meaning |
| --- | --- |
| GET `pageSize` of 1 or more | Page `page` (zero-based, default 0) of that size |
| GET `pageSize` of 0, negative, or not an integer | 400 `malformedRequest` |
| `QUERY` `paging.pageSize` of 1 or more | Page `paging.page` of that size |
| `QUERY` with `pageSize: 0`, or without `pageSize` | Unpaged |
| `sortBy` or `sorting.field` | Sort by that field. The name must start with a letter and contain only letters, digits, and `_`. |
| `sortDirection` or `sorting.direction` | `asc`, `ascending`, `desc`, or `descending`, in any case; `asc` by default. A direction without a field answers 400. |

In-memory sorting requires the field on every item, or the request answers 400. Dates compare by time, numbers and bigints numerically, `false` before `true`, and `null` or `undefined` before any value in ascending order. Other values compare as strings with `localeCompare`, which is not .NET invariant-culture collation; sort in the data source when a stable cross-platform order matters.

A query that returns something other than an array answers 400 when the request asks for paging or sorting.

## Return a page your data source cut

Loading every row to page it in memory does not scale. Add `queryOptions()` to receive the request's paging and sorting, cut the page in your data source, and return `queryPage(items, totalItems)`, as `recent` does. `GET /api/recent?pageSize=2&page=1` returns `Fig` with `totalItems: 3`.

- `items` must be exactly the requested page: the page size, or fewer on the last page. For an unpaged request, `items` must hold all `totalItems`. Anything else answers 400.
- A request that asks for sorting answers 400 unless you pass the applied sort as the third argument, `queryPage(items, totalItems, sorting)`, confirming your data source sorted it. Arc never re-sorts a page it did not cut.
- `queryPage` throws when `totalItems` is negative, not a safe integer, or smaller than the number of items; the query then fails with a 500.

The [MongoDB](../../mongodb/paging.md) and [Drizzle](../../sql/paging.md) integrations return such pages for you, with sorting pushed into the database.

## Related

- [Query arguments](query-arguments.md)
- [Query renderers](../renderers.md) for provider-owned results
- [Calling commands from code](../../commands/calling-commands-from-code.md), where `performQuery` takes the same options

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
        const offset = Math.min(2_147_483_647, page * size);
        const items = size ? catalog.items.slice(offset, offset + size) : catalog.items;
        return queryPage(items, catalog.items.length);
    }
}
```

With `Catalog` registered as a singleton, `GET /api/all?pageSize=2&sortBy=name&sortDirection=desc` returns `Pear` and `Fig`, with `paging` reporting `{"page":0,"size":2,"totalItems":3,"totalPages":2}`.

## Request parameters

| Request | Meaning |
| --- | --- |
| GET `pageSize` of 1 or more | Page `page` (zero-based, default 0) of that size |
| GET `pageSize` of 0 or negative, or `page` negative with any integer size | 400 with a paging rule (`Size` or `Page`); both invalid values report `Page` then `Size` |
| GET nonnumeric or out-of-int32 `page`/`pageSize` | Defaults to page 0 or unpaged, respectively; a negative `page` is ignored if `pageSize` cannot be parsed. Leading zeros, `+`, and ASCII integer whitespace are accepted; nonbreaking spaces are not |
| `QUERY` `paging.pageSize` of 1 or more | Page `paging.page` of that size |
| `QUERY` with nonpositive `pageSize`, or without `pageSize` | Unpaged; a page without a size is ignored |
| `QUERY` with nonnumeric or out-of-int32 paging values | 400 exception envelope (redacted unless `exposeExceptionDetails`); even a page without a size must be an integer; the handler does not run |
| `sortBy` or `sorting.field` | Sort by that field. The name must start with a letter and contain only letters, digits, and `_`. |
| `sortDirection` or `sorting.direction` | `asc`, `ascending`, `desc`, or `descending`, in any case; `asc` by default. A QUERY direction without a field is ignored; GET rejects it. |

Invalid directions answer 400 with `malformedRequest` and the `sortDirection` (GET) or `sorting.direction` (`QUERY`) member. Page offsets are clamped to the signed 32-bit maximum before slicing in memory, so large valid page and size values cannot overflow the offset. Providers that cut their own pages must apply equivalent bounds before using the offset in their data source.

In-memory sorting requires the field on every item, or the request answers 400. Dates compare by time, numbers and bigints numerically, `false` before `true`, and `null` or `undefined` before any value in ascending order. Other values compare as strings with `localeCompare`, which is not .NET invariant-culture collation; sort in the data source when a stable cross-platform order matters.

A query that returns something other than an array answers 400 when the request asks for paging or sorting.

## Return a page your data source cut

Loading every row to page it in memory does not scale. Add `queryOptions()` to receive the request's paging and sorting, cut the page in your data source, and return `queryPage(items, totalItems)`, as `recent` does. `GET /api/recent?pageSize=2&page=1` returns `Fig` with `totalItems: 3`.

- `items` must be exactly the requested page: the page size, or fewer on the last page. For an unpaged request, `items` must hold all `totalItems`. Anything else answers 400.
- A request that asks for sorting answers 400 unless you pass the applied sort as the third argument, `queryPage(items, totalItems, sorting)`, confirming your data source sorted it. Arc never re-sorts a page it did not cut.
- `queryPage` throws when `totalItems` is negative, not a safe integer, or smaller than the number of items; the query then fails with a 500.

A provider can throw the public `QueryPagingRequired(maxPageSize, unpaged?, message?)` error to report its own limit.
Arc maps its message to a 400 `rule` validation result on `Size`. Pass `true` for `unpaged` when a result without paging
exceeds the limit; supply a message only when the default request-paging advice does not apply to the operation.
Similarly, `InvalidQuerySort` maps to a 400 `rule` result on `sorting.field` for a provider-rejected sort field.

The [MongoDB](../../mongodb/paging.md) and [Drizzle](../../sql/paging.md) integrations return such pages for you, with sorting pushed into the database. Without paging, their `queryPage` reads at most the configured maximum page size. If more rows exist, the provider answers 400 with a `rule` result on `Size` asking the caller to request paging, rather than returning a misleading partial list. A requested page size above the provider maximum also answers 400 with a `rule` result on `Size`.

## Related

- [Query arguments](query-arguments.md)
- [Query renderers](../renderers.md) for provider-owned results
- [Calling commands from code](../../commands/calling-commands-from-code.md), where `performQuery` takes the same options

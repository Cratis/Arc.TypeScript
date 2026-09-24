---
title: Page and sort SQL read models
description: Push count, sort, limit, and offset into SQL with DrizzleReadModels.queryPage, and know the sort-field and consistency rules.
---

Declare a Drizzle table with at least one column marked `.primaryKey()` and register it with `readModels`. A composite primary key declared only through Drizzle's table extras does not mark individual columns for this adapter's stable tie-breaker. Your model-bound query receives Arc's `queryOptions()` and calls `DrizzleReadModels.queryPage(filter, options)`. The method requires `options.paging`, with a nonnegative safe page index and a positive page size no larger than `maxPageSize` (100 by default, maximum configurable value 10,000). The filter is an optional application-built Drizzle `SQL` expression.

Arc pushes `count(*)`, ordering, `limit` and `offset` to the selected tenant database. The count is calculated before the page, so `totalItems` is not the length of the page. Requested `sorting.field` must be both a declared Arc `@field` and a property returned by `getTableColumns(table)`; only those fields and the primary key are selected. A private table column cannot be used to infer its order; an unknown field or unsupported direction fails before SQL runs and the Arc HTTP pipeline maps unknown fields to 400. All queries sort by the primary key as a stable tie-breaker when needed. The query never interpolates the client field as SQL text.

`find(filter, sorting?)` returns all matches only when the count is at most `maxPageSize`; otherwise it throws. `findOne(filter)` returns the first match ordered by primary key, or `undefined`. Both use Drizzle's mapped selection and avoid loading an unbounded result.

Count and page are separate statements. A concurrent write between them can change membership: this adapter does not promise snapshot isolation or an EF transaction. If the page length no longer agrees with the count, Arc may reject the result as malformed rather than return an inconsistent page. Use an application-managed transaction when that consistency matters; there is no automatic transaction shared with command execution. Offset paging may become expensive for deep pages, so index the filtered and sorted fields and set an appropriate maximum.

The [adapter HTTP spec](https://github.com/Cratis/Arc.TypeScript/blob/main/Source/Drizzle/for_DrizzleReadModels/when_serving_a_sqlite_page/with_each_http_adapter.ts) exercises sorting, count and field rejection through all three hosts.

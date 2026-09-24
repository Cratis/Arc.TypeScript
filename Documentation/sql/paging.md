---
title: Page and sort SQL read models
---

Declare a Drizzle table with a primary key and register it with `readModels`. Your model-bound query receives Arc's `queryOptions()` and calls `DrizzleReadModels.queryPage(filter, options)`. The method requires `options.paging`, with a nonnegative safe page index and a positive page size no larger than `maxPageSize` (100 by default, maximum configurable value 10,000). The filter is an optional application-built Drizzle `SQL` expression.

Arc pushes `count(*)`, ordering, `limit` and `offset` to the selected tenant database. The count is calculated before the page, so `totalItems` is not the length of the page. Requested `sorting.field` must match a property name returned by `getTableColumns(table)`; an unknown field or unsupported direction fails before SQL runs and the Arc HTTP pipeline maps unknown fields to 400. All queries sort by the primary key as a stable tie-breaker when needed. The query never interpolates the client field as SQL text.

Count and page are separate statements. A concurrent write between them can change membership: this adapter does not promise snapshot isolation or an EF transaction. If the page length no longer agrees with the count, Arc may reject the result as malformed rather than return an inconsistent page. Use an application-managed transaction when that consistency matters; there is no automatic transaction shared with command execution. Offset paging may become expensive for deep pages, so index the filtered and sorted fields and set an appropriate maximum.

The [adapter HTTP spec](../../Source/Drizzle/for_DrizzleReadModels/when_serving_a_sqlite_page/with_each_http_adapter.ts) exercises sorting, count and field rejection through all three hosts.

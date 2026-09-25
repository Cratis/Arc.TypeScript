---
title: Page and sort SQL read models
description: Push count, sort, limit, and offset into SQL with DrizzleReadModels.queryPage, filter with a typed predicate, and know the sort-field, size, and consistency rules.
---

A task table grows to a million rows, and the client shows ten at a time. Loading every row to cut a page in memory stops working long before that. `DrizzleReadModels.queryPage` sends the count, the sort, and the page to the database and returns an Arc page with the real total.

## Page a query

```typescript
import { eq } from 'drizzle-orm';
import { query, queryOptions, readModel, service, type QueryOptions } from '@cratis/arc.core';
import { drizzleReadModel, type DrizzleReadModels } from '@cratis/arc.drizzle';
import { TaskRecord, tasks } from './Tasks.js';

@readModel()
export class TaskQueries {
    @query(service(drizzleReadModel(TaskRecord)), queryOptions())
    static page(items: DrizzleReadModels<TaskRecord>, options: QueryOptions) {
        return items.queryPage(undefined, options);
    }

    @query(service(drizzleReadModel(TaskRecord)), queryOptions())
    static open(items: DrizzleReadModels<TaskRecord>, options: QueryOptions) {
        return items.queryPage(eq(tasks.title, 'open'), options);
    }
}
```

`TaskRecord` and `tasks` are the model and table from [Get started](getting-started.md). A GET with `page=0&pageSize=10&sortBy=title` runs a `count(*)` and a `select ... order by ... limit 10 offset 0` in the tenant's database, and answers with ten tasks and `paging.totalItems` from the count. The second query filters with a typed Drizzle predicate first; a filter is optional, and `undefined` means every row.

Build filters from trusted values with Drizzle's operators, which bind parameters. Never interpolate request text into SQL.

## Rules

| Rule | Detail |
| --- | --- |
| Paging absent | `queryPage` reads the first `maxPageSize` rows. Arc returns an unpaged response only when the count fits; otherwise it rejects the incomplete list with 400. |
| Page size | At least 1, at most `maxPageSize`: 100 by default, configurable up to 10,000 with `withDrizzle({ maxPageSize })` |
| Page index | A nonnegative safe integer |
| Sort field | Must be a declared `@field` on the model **and** a column of the table. An unknown field, or a table column the model does not declare, answers 400 before any SQL runs |
| Sort direction | `asc` or `desc` |
| Tie-breaker | The primary key, ascending, so pages stay stable when sort values repeat |
| Selected columns | Only the model's declared fields and the primary key; other columns are never read |

The client's sort field is matched against the declared fields and never becomes SQL text. PostgreSQL 16 and MySQL 8.4 live checks exercise count, sorted pages, and decoded columns; MySQL also checks tie-breaking, invalid sort rejection, and `QueryPagingRequired` limits. A table needs at least one column marked `.primaryKey()`. A composite key declared only through Drizzle's table extras does not mark individual columns, so the adapter cannot use it as a tie-breaker, and registration fails.

## Unpaged reads

`find(filter, sorting?)` returns every match only when there are at most `maxPageSize` of them. Above that limit it
rejects with a `QueryPagingRequired` error saying to use `queryPage`, rather than silently truncating. Use `queryPage`
for paged endpoints: `find` does not accept paging options, even if the client sends `pageSize`. `findOne(filter)` returns
the first match in primary-key order, or `undefined`.

## Consistency

The count and the page are separate statements. A write between them can change which rows are counted or returned; the adapter does not promise snapshot isolation. When the page no longer agrees with the count, Arc may reject the result as malformed instead of returning an inconsistent page. Offset paging gets slower for deep pages, so index the filtered and sorted columns and keep `maxPageSize` sensible.

## Related

- [Paging and sorting](../queries/model-bound/paging.md) for the request parameters
- [Get started with SQL](getting-started.md)

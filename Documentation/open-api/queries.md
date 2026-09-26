---
title: Queries in the document
description: See how each Arc query appears in /openapi.json as a GET operation with query-string arguments, paging and sorting parameters, observable-query options, and a QueryResult envelope with typed data.
---

A client calling `allTasks` wants to know which arguments it may pass, whether it can ask for page two sorted by title, and what shape the rows have. Arc describes each query as a GET operation with its arguments, the paging and sorting parameters the runtime honors, and the `QueryResult` envelope around the data.

## One GET operation per query

The Tasks sample's `TaskItem.taskById` query appears as `GET /api/tasks/listing/task-by-id` with `operationId` `Tasks.Listing.TaskItem.taskById` and tag `Tasks.Listing`. Queries accept HTTP `QUERY` too, but OpenAPI has no path item for that method, so the document lists GET only.

Each query argument becomes a `query` parameter. `required` comes from the input schema: an argument declared with `argument(name, Type, { optional: true })`, or a Zod field that accepts `undefined`, such as one with `.optional()` or `.default(...)`, is not required. `taskById(id: TaskId)` has one required parameter, `id`, described as a UUID string.

## Paging and sorting parameters

Arc adds four parameters to a query that can return a list:

| Parameter | Schema |
| --- | --- |
| `page` | integer, minimum 0 |
| `pageSize` | integer, minimum 1 |
| `sortBy` | string |
| `sortDirection` | `asc`, `ascending`, `desc`, or `descending` |

A query "can return a list" when generated metadata declares an array result, or when Arc does not know the result type. A query declared to return one item, such as `taskById`, or nothing, gets no paging parameters. `allTasks` returns `TaskItem[]`, so it lists all four.

`page`, `pageSize`, `sortBy`, and `sortDirection` are reserved query-string names, compared case-insensitively: Arc reads them as paging and sorting and removes them before binding the query's arguments, so a query argument with one of these names never receives the value. Name your own arguments differently.

These parameters describe what a client may send. How a query honors them depends on its result; see [Paging](../queries/model-bound/paging.md).

## Observable queries

An [observable query](../queries/observable-queries.md), such as `observeAllTasks`, adds two parameters and three responses:

| Addition | Meaning |
| --- | --- |
| `waitForFirstResult` | boolean; wait for the first value instead of answering 202 |
| `waitForFirstResultTimeout` | number of seconds, greater than 0 and at most 120 |
| 200 `text/event-stream` | The Server-Sent Events stream, next to the JSON snapshot |
| 202 | No current value yet |
| 408 | The first-result wait timed out |
| 503 | The subscription limit was reached |

WebSocket and multiplexed hub transports are not described. [Using observable queries with curl](../queries/using-observable-queries-with-curl.md) shows each HTTP answer.

## Responses

Every query documents 200, 400, 403, and 500, all with the `QueryResult` envelope. It carries the same `correlationId`, `isSuccess`, `isAuthorized`, `isValid`, `hasExceptions`, `validationResults`, `exceptionMessages`, and `exceptionStackTrace` properties as a [command's envelope](commands.md#responses), plus:

| Property | Type |
| --- | --- |
| `isReady` | boolean |
| `paging` | `{ page, size, totalItems, totalPages }`, all integers |
| `data` | The result type; 200 only, and only when generated metadata declares it |

`data` follows the result's cardinality. `allTasks` has an array of `TaskItem` objects. `taskById` returns `TaskItem | undefined`, so its `data` is `anyOf` the `TaskItem` object and `null`. Result object schemas set `additionalProperties: false`.

Error envelopes (400, 403, 500, and the observable 202, 408, and 503) never include `data`.

## Differences from Arc on .NET

- The sort parameter is `sortBy`. The .NET transformer names it `sortby`.
- Required arguments are marked `required: true`. The .NET model-bound transformer marks every argument optional.
- Paging parameters follow the declared result, not a runtime enumerable check.

## Related

- [Commands in the document](commands.md)
- [Model-bound and low-level operations](model-bound.md)
- [Query arguments](../queries/model-bound/query-arguments.md)

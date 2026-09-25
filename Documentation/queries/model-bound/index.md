---
title: Model-bound queries
description: Put static query methods on a read-model class, bind their arguments and services, and know which return types Arc accepts, how it awaits them, and what absence looks like.
---

A task list, a lookup by ID, and a live board all read the same kind of data. Written as separate routes, each needs its own argument parsing, its own "not found" convention, and its own response shape. In Arc you put these reads on the read model they return, as static methods. Each `@query()` method becomes a route, its parameters are bound from the request or resolved as services, and every answer uses the same `QueryResult` envelope.

## Declare a read model and its queries

The [Tasks sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Listing/Listing.ts) exposes a list, a lookup, and a live list:

```typescript title="Features/Tasks/Listing/Listing.ts"
import { field } from '@cratis/fundamentals';
import { query, readModel, service } from '@cratis/arc.core';
import type { BehaviorSubject } from 'rxjs';
import { TaskId } from '../TaskId.js';
import { TaskTitle } from '../TaskTitle.js';
import { Tasks } from '../Tasks.js';

@readModel()
export class TaskItem {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    @query(service(Tasks))
    static allTasks(tasks: Tasks): TaskItem[] { return tasks.all(); }

    @query()
    static taskById(id: TaskId, tasks: Tasks): TaskItem | undefined { return tasks.byId(id); }

    @query()
    static observeAllTasks(tasks: Tasks): BehaviorSubject<TaskItem[]> { return tasks.observeAll(); }
}
```

With the sample running, `GET /api/tasks/listing/all-tasks` returns the list, and `GET /api/tasks/listing/task-by-id?id=<uuid>` returns one task. The `@field` declarations describe the shape each query returns; Arc encodes it on the way out, and the [proxy generator](../../proxy-generation/index.md) uses the same declarations for the frontend model.

## What makes a method a query

Arc serves a method when all three hold:

- the class is marked `@readModel()`,
- the method is `static`,
- the method is marked `@query(...)`.

Any other static method on the class is an ordinary helper and gets no route. That lets you keep shared filtering or mapping code next to the queries without exposing it. Arc rejects the declarations that would otherwise be silently ignored. `@query()` on an instance or private method throws as soon as the class is loaded, and `@roles`, `@authorize`, `@allowAnonymous`, or `@path` on a static method without `@query()` fails at `build()`.

## Bind every parameter

Each parameter is one of three kinds:

| Descriptor | Binds |
| --- | --- |
| `argument(name, Type, options?)` | A named argument from the query string or `QUERY` body; see [Query arguments](query-arguments.md) |
| `service(Token)` | A service from the execution scope; see [Dependency injection](../../dependency-injection.md) |
| `queryOptions()` | The request's paging and sorting; see [Paging and sorting](paging.md) |

Standard decorators cannot see parameter types, so Arc needs to learn them somewhere:

- **With [generated artifact metadata](../../proxy-generation/generated-artifact-metadata.md)**, as the sample uses, `@query()` is enough. The generator reads the source: a primitive, concept, or array of them becomes a named argument, and a concrete class becomes a service. That is how `taskById(id: TaskId, tasks: Tasks)` binds `id` from the query string and `tasks` from the scope.
- **Without it**, list one descriptor per parameter, in the same order as the method signature: `@query(argument('id', TaskId), service(Tasks))`. `allTasks` shows this form; explicit descriptors always win over generated ones.

A mismatch fails early. TypeScript error TS1241 on a `@query(...)` usually means the descriptors do not match the parameters, and a parameter nobody describes fails at `build()` with `Unbound parameters`. See [Troubleshooting](../../troubleshooting.md#ts1241-unable-to-resolve-signature-of-method-decorator).

Services resolve from a fresh scope per request, or per subscription for an observable query. A scoped service is never shared between two callers.

## Return what the caller should see

A query method returns data, and Arc wraps it:

| The method returns | The caller gets |
| --- | --- |
| An array of the model | `data` is the array. Arc [pages and sorts it in memory](paging.md) when the request asks |
| One model | `data` is the object |
| `undefined` or `null` | A successful result with no `data` property |
| `queryPage(items, totalItems)` | `data` is `items`, and `paging` reports your totals; see [Paging and sorting](paging.md#return-a-page-your-data-source-cut) |
| A value a registered [renderer](../renderers.md) accepts | Whatever the renderer produces, such as a database-side page |
| An observable source | A live query; see [Declare observable queries](#declare-observable-queries) |

A method can be `async` or return a promise of any of these. Arc awaits it before rendering, so `static async byId(...): Promise<TaskItem | undefined>` behaves exactly like its synchronous version. The same holds for an observable query: an `async` method that awaits setup work and then returns a source is fine.

Decorated models and concepts are encoded to their wire shape, so a `TaskId` goes out as a UUID string.

## Absence is an answer, not an error

`taskById` returns `undefined` when no task has that ID. The caller gets HTTP 200, `isSuccess: true`, and no `data` property. An empty array is a successful empty list. Arc does not turn absence into a 404, because a query that found nothing did its job.

A thrown error is different. It becomes a failed result with `hasExceptions: true` and status 500, and the message is replaced unless you enable exception details. Let storage failures throw; never catch them and return `undefined` or `[]`, or the caller cannot tell "no task" from "the database is down".

With generated metadata, Arc also checks the value against the declared return type. A method declared as `TaskItem` that returns `undefined`, or one declared as `TaskItem[]` that returns a single object, fails with an exception instead of sending the caller a shape its generated client does not expect. Declare `TaskItem | undefined` when absence is possible.

## Declare observable queries

A query that returns a live source serves a snapshot on GET and streams changes to subscribers. With generated metadata, Arc infers this from the declared return type, as it does for `observeAllTasks`. Without it, add `{ observable: true }`: `@query({ observable: true }, service(Tasks))`. Arc needs to know before registration so snapshots, server-sent events, WebSocket admission, introspection, and generated clients agree on the contract. A snapshot query that returns a live source anyway fails at run time.

Use an RxJS `BehaviorSubject` when there is always a current value, and `Subject` or `Observable` when there may not be one yet. [Observable queries](../observable-queries.md) covers sources, paging, and authorization, and [Subscribe to an observable query](../subscribing-to-observable-queries.md) covers the transports.

## Routes and identity

By default the route is `/api/<discovery-namespace>/<method-name>`: `TaskItem.allTasks` lives at `/api/tasks/listing/all-tasks`. Its identity is `Tasks.Listing.TaskItem.allTasks`, including the read-model class. `@path('/api/custom-path')` on a query method overrides the class path. See [Endpoint mapping](../../core/endpoint-mapping.md).

## Authorization

`@roles`, `@authorize`, and `@allowAnonymous` work on the read-model class and on query methods. An explicit method declaration replaces the class declaration; without one, the method inherits it. For example, class `@allowAnonymous()` does not bypass method `@roles('Reader')`. A denied caller never reaches the method and gets `isAuthorized: false`. A role says who may call the query, not which rows they may see; see [Authorizing commands and queries](../../authorizing-commands-and-queries.md#queries-roles-and-ownership).

## Recap

A read model owns its queries as static `@query()` methods. Generated metadata, or explicit descriptors, tell Arc which parameters are arguments and which are services. Return the data, sync or async; return nothing for absence and throw for failure; return a source for a live query. Arc supplies the route, the envelope, and paging.

## Next step

[Query arguments](query-arguments.md) covers optional, array, and concept arguments. Then [Paging and sorting](paging.md) shows how to cut a page in your data source instead of in memory.

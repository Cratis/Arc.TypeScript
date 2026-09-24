---
title: Model-bound queries
description: Put static query methods on a read-model class, list their arguments and services in order, and declare observable queries.
---

Put related read operations on a `@readModel()` class as static methods. Each `@query(...)` method becomes a route, and its parameters are bound from the request or resolved as services.

## Declare a read model and its queries

The [Tasks sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Listing/TaskItem.ts) exposes a list, a lookup, and a live list:

```typescript
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

The `@field` declarations describe the shape the query returns, and the [proxy generator](../../proxy-generation/index.md) uses them for the frontend model.

## Describe every parameter, in order

Each parameter gets one descriptor, in the **same order as the method signature**:

| Descriptor | Binds |
| --- | --- |
| `argument(name, Type, options?)` | A named argument from the query string or `QUERY` body; see [Query arguments](query-arguments.md) |
| `service(Token)` | A service from the execution scope; see [Dependency injection](../../dependency-injection.md) |
| `queryOptions()` | The request's paging and sorting; see [Paging and sorting](paging.md) |

With [generated artifact metadata](../../proxy-generation/generated-artifact-metadata.md) installed, Arc infers argument names, types, concrete services, and observable returns from these declarations. Without it, standard decorators cannot see parameter types: use `@query(argument('id', TaskId), service(Tasks))` and declare `{ observable: true }` on observable methods. Legacy `experimentalDecorators` and `emitDecoratorMetadata` can infer class-valued services; explicit descriptors always win. TypeScript error TS1241 on a `@query(...)` usually means the descriptors do not match the parameters; see [Troubleshooting](../../troubleshooting.md#ts1241-unable-to-resolve-signature-of-method-decorator).

## Return a value

A query method can return a value or a promise of one: an array, a single model, `undefined`, a [`queryPage`](paging.md#return-a-page-your-data-source-cut), or a value a [renderer](../renderers.md) understands. Arc encodes decorated models and concepts to their wire shape.

## Declare observable queries

A query that returns a live source must declare `{ observable: true }` without generated metadata; generated metadata infers it from the return type before registration, so snapshots, server-sent events, WebSocket admission, introspection, and generated clients know its contract before it runs. Use an RxJS `BehaviorSubject` for an immediate snapshot, or `Subject`/`Observable` when no current value exists. Async iterables and structural subscribables remain supported; `CurrentValueSubject` is deprecated. See [Observable queries](../observable-queries.md).

## Routes and identity

By default the route is `/api/<discovery-namespace>/<method-name>`: `TaskItem.allTasks` lives at `/api/tasks/listing/all-tasks`. Its identity is `Tasks.Listing.TaskItem.allTasks`, including the read-model class. `@path('/api/custom-path')` on a query method overrides the class path. See [Endpoint mapping](../../core/endpoint-mapping.md).

## Authorization

`@roles`, `@authorize`, and `@allowAnonymous` work on the read-model class and on query methods. A method's declaration replaces the class declaration. Authorization or a path on a static method without `@query()` is rejected at build instead of being silently ignored. See [Authorizing commands and queries](../../authorizing-commands-and-queries.md).

## Related

- [Query arguments](query-arguments.md)
- [Paging and sorting](paging.md)
- [Testing queries](../../testing/queries.md)

---
title: Define read models and queries
---

Put related read operations on a `@readModel()` class as static methods. The [Tasks sample](../../Samples/Tasks/Features/Tasks/Listing/TaskItem.ts) exposes a list, a named lookup, and an observable list:

```typescript
@readModel()
export class TaskItem {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    @query(service(Tasks))
    static allTasks(tasks: Tasks): TaskItem[] { return tasks.all(); }

    @query(argument('id', TaskId), service(Tasks))
    static taskById(id: TaskId, tasks: Tasks): TaskItem | undefined { return tasks.byId(id); }

    @query({ observable: true }, service(Tasks))
    static observeAllTasks(tasks: Tasks): ObservableSource<TaskItem[]> { return tasks.observeAll(); }
}
```

The snippet is an excerpt: the linked file has its imports and domain types. Import `field` from `@cratis/fundamentals`, and `readModel`, `query`, `argument`, `service`, and `ObservableSource` from `@cratis/arc.core`. Every parameter gets a descriptor in the **same order as the method signature**. Arguments bind by name (case-insensitively) from GET query strings or a structured HTTP `QUERY` body; services come from the execution scope. An optional argument before a required service uses `TaskId | undefined` and `argument('id', TaskId, { optional: true })`, not TypeScript's `id?: TaskId` syntax. For repeated GET keys, declare an array argument with `argument('ids', Array, { elementType: TaskId })`; each value is decoded to a `TaskId`.

Observable queries must declare `{ observable: true }` at registration so snapshots, SSE, WebSocket admission, introspection, and clients know the query's contract before invocation. The producer may be an async iterable or a structural subscribable. A current value answers GET immediately; without one, a snapshot answers 202 until an emission arrives. Add `Accept: text/event-stream` to GET the same route for SSE. The [observable guide](observable-queries.md) covers readiness, cancellation, and transport details.

By default the route is `/api/<discovery-namespace>/<method-name>`; `TaskItem.allTasks` lives at `/api/tasks/listing/all-tasks`. Its query identity is `Tasks.Listing.TaskItem.allTasks`, including the read-model class. `@route('/api/custom-path')` on a query method overrides the class route. Authorization on a query method overrides authorization on its read-model class. This is not a persisted read model: `Tasks` is only an in-memory example; use your own read service or the optional [MongoDB helper](mongodb.md) for storage.

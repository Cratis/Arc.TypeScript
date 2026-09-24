---
title: Define read models and queries
description: Put static query methods on a read-model class, bind their arguments and services in order, and expose an observable query.
---

Put related read operations on a `@readModel()` class as static methods. The [Tasks sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Listing/TaskItem.ts) exposes a list, a named lookup, and an observable list:

```typescript
@readModel()
export class TaskItem {
    @field(TaskId) id!: TaskId;
    @field(TaskTitle) title!: TaskTitle;

    @query(service(Tasks))
    static allTasks(tasks: Tasks): TaskItem[] { return tasks.all(); }

    @query()
    static taskById(id: TaskId, tasks: Tasks): TaskItem | undefined { return tasks.byId(id); }

    @query()
    static observeAllTasks(tasks: Tasks): ObservableSource<TaskItem[]> { return tasks.observeAll(); }
}
```

The snippet is an excerpt: the linked file has its imports and domain types. Import `field` from `@cratis/fundamentals`; import `readModel`, `query`, `service`, and `ObservableSource` from `@cratis/arc.core`. With [generated artifact metadata](generated-artifact-metadata.md) installed, `@query()` binds `id` by name and type and resolves `Tasks` from the execution scope. The `allTasks` method keeps an explicit `service(Tasks)` example; it works without a build step. In that mode supply a complete ordered descriptor list, such as `@query(argument('id', TaskId), service(Tasks))`. An optional argument before a service uses `TaskId | undefined` and `argument('id', TaskId, { optional: true })` in explicit mode. For repeated GET keys, declare an array argument with `argument('ids', Array, { elementType: TaskId })`.

Generated metadata infers `observable: true` from the declared `ObservableSource<TaskItem[]>` return. Without generation, write `@query({ observable: true }, service(Tasks))`. Arc needs that contract at registration so snapshots, SSE, WebSocket admission, introspection, and clients know the query's shape before invocation. The producer may be an async iterable or a structural subscribable. A current value answers GET immediately; without one, a snapshot answers 202 until an emission arrives. `CurrentValueSubject.of(value)` replays that first value to new SSE and WebSocket subscribers, too. Add `Accept: text/event-stream` to GET the same route for SSE. The [observable guide](observable-queries.md) covers readiness, cancellation, and transport details.

By default the route is `/api/<discovery-namespace>/<method-name>`; `TaskItem.allTasks` lives at `/api/tasks/listing/all-tasks`. Its query identity is `Tasks.Listing.TaskItem.allTasks`, including the read-model class. `@path('/api/custom-path')` on a query method overrides the class path. Authorization on a query method overrides authorization on its read-model class. Authorization or a path on a static method without `@query()` is rejected at build time instead of being silently ignored. This is not a persisted read model: `Tasks` is only an in-memory example; use your own read service or the optional [MongoDB helper](mongodb.md) for storage.

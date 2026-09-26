---
title: Observable queries
description: Serve a current snapshot and live updates from one query route, choose a source, and control paging, authorization, and subscription lifetime.
---

A task board should update when someone adds a task, without the browser polling. An observable query serves the current snapshot on an ordinary GET and streams every change to subscribers, from the same route and the same pipeline.

## Declare an observable query

The [Tasks sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Listing/Listing.ts) declares its live list as an ordinary query that returns a source:

```typescript
@query()
static observeAllTasks(tasks: Tasks): BehaviorSubject<TaskItem[]> { return tasks.observeAll(); }
```

The sample's `Tasks` service keeps a `new BehaviorSubject<TaskItem[]>([])` from RxJS and calls `next(...)` whenever a task is registered.

Arc has to know that a query is observable before it runs: snapshots, server-sent events, WebSocket admission, introspection, and generated clients all depend on it. The sample installs [generated artifact metadata](../proxy-generation/generated-artifact-metadata.md), which reads the declared return type, so bare `@query()` is enough. Without generated metadata, say so explicitly and list the parameters:

```typescript
@query({ observable: true }, service(Tasks))
static observeAllTasks(tasks: Tasks): BehaviorSubject<TaskItem[]> { return tasks.observeAll(); }
```

## Choose a source

| Source | Snapshot behavior |
| --- | --- |
| RxJS `BehaviorSubject<T>` | Has a current value: GET answers 200 immediately, and new subscribers receive it first |
| RxJS `Subject<T>` or `Observable<T>` | No current value: GET answers 202 with `isReady: false`; `waitForFirstResult=true` subscribes until the first value |
| RxJS `ReplaySubject<T>` | No readable current value: GET answers 202 even after an emission; a waiting GET receives the buffered value |
| `AsyncIterable<T>` | No current value until the first item |
| `CurrentValueSubject<T>` (deprecated) | Legacy current/pending source; use RxJS `BehaviorSubject` or `Subject` instead |

A `BehaviorSubject` exposes its current value, including `undefined`; `Subject` and `ReplaySubject` do not. The core accepts structural subscribables and async iterables without loading RxJS at runtime, so RxJS is an optional peer dependency for consumers using only async iterables.

## When there is nothing to show

A live lookup, such as "the task with this ID", may have nothing to show yet. Two different situations look alike from the outside:

| The source | A snapshot GET answers | A subscriber receives |
| --- | --- | --- |
| Has no current value yet (`Subject`, `Observable`, an empty async iterable) | 202 with `isReady: false` | Nothing until the first emission |
| Emits `undefined` or `null` (a `BehaviorSubject<TaskItem \| undefined>` with nothing stored) | 200, `isReady: true`, no `data` property | A ready result without `data` |

In both cases the subscription stays open. When the document appears and the source emits it, the subscriber receives it like any other update, and when it disappears again the source can emit `undefined`. Emit `undefined` for "we looked and nothing is there", and leave a source silent only when you genuinely do not know yet; a client can tell the two apart by `isReady`.

An error is neither. A source that errors ends the subscription with a failed result, and a source that completes before its first value returns an error to a waiting GET. Do not turn a storage failure into an `undefined` emission.

## Subscription lifetime

Each subscription runs your query method once, after authorization and validation, and then follows the source it returned:

- The subscription owns its own service scope for its whole life. Scoped services are not shared between subscribers, and they are disposed when the subscription ends.
- The method can read the caller with `currentContext()` from `@cratis/arc.core`, which returns the subscription's execution context, and its `signal` aborts when the subscription ends. Pass it to anything that must stop with the subscriber.
- The subscription ends when the client disconnects or unsubscribes, when the source completes or errors, or when an [emission guard](observable-query-emission-guards.md) denies an emission. Arc then cancels the source and disposes the scope.

## Read the snapshot and subscribe from the terminal

With the Tasks sample running:

```bash
curl http://127.0.0.1:3000/api/tasks/listing/observe-all-tasks
curl -N -H 'Accept: text/event-stream' http://127.0.0.1:3000/api/tasks/listing/observe-all-tasks
```

The first answers 200 with the current tasks in `data`. The second keeps the connection open and prints a `data: <query result JSON>` frame now, and another whenever you register a task. [Using observable queries with curl](using-observable-queries-with-curl.md) covers waiting for a first result and the error codes.

## Page and sort a live list

The paging and sorting parameters work on an observable query exactly as on a snapshot query, and they apply to **every** emission:

```bash
curl -N -H 'Accept: text/event-stream' \
  'http://127.0.0.1:3000/api/tasks/listing/observe-all-tasks?pageSize=1&page=1&sortBy=title&sortDirection=desc'
```

With two tasks registered, each frame holds the second task in descending title order, and `paging` reports `{"page":1,"size":1,"totalItems":2,"totalPages":2}`. When a third task arrives, the next frame is sorted and cut again, and `totalItems` follows the whole list. A generated client's `useWithPaging(pageSize)` hook sends the same parameters.

Arc pages the arrays your source emits, in memory. An observable query cannot return a `queryPage`; generated metadata rejects that declaration at build. For a collection too large to emit whole, narrow what the source emits with query arguments, or use a database integration that observes a query, such as [MongoDB change streams](../mongodb/observing-collections.md) or [in-process SQL observation](../sql/observing-tables.md) with `observePage`. The [paging rules](model-bound/paging.md#request-parameters) for invalid sizes and sort fields are the same as for snapshots.

## Authorize a live query

An observable query takes the same `@roles`, `@authorize`, and `@allowAnonymous` declarations as any query, and Arc checks them, with validation, when a subscription opens. A denied snapshot GET answers 401 or 403 with `isAuthorized: false`, following the [status code rules](../authorizing-commands-and-queries.md#status-codes); a denied hub subscription receives an `Unauthorized` frame. The query method never runs for a denied caller.

That check happens **once**. Arc keeps a copy of the caller's identity for the life of the subscription and does not re-run authorization on each emission, so a role revoked or a session that expires after the subscription opened does not close it. When access must be re-checked while the stream runs, add an [emission guard](observable-query-emission-guards.md), which sees every result before delivery and can end the subscription.

A role decides who may subscribe, not which rows they see. For a query like "my tasks", filter inside the source by the caller's identity:

```typescript title="MyTasks.ts"
import { field } from '@cratis/fundamentals';
import { authorize, currentContext, query, readModel } from '@cratis/arc.core';
import { BehaviorSubject, map, type Observable } from 'rxjs';

const tasks = new BehaviorSubject<OwnedTask[]>([]);

@readModel()
@authorize()
export class OwnedTask {
    @field(String) id!: string;
    @field(String) title!: string;
    @field(String) owner!: string;

    @query({ observable: true })
    static myTasks(): Observable<OwnedTask[]> {
        const caller = currentContext()?.principal?.id;
        return tasks.pipe(map(all => all.filter(task => task.owner === caller)));
    }
}
```

`@authorize()` turns anonymous callers away before `myTasks` runs, so `caller` is always an authenticated ID. Each subscriber gets their own filtered stream: when a task owned by `ada` is added, only Ada's subscription emits a new list with it. The filter runs in the producer, so rows the caller must not see never enter the result at all. Never leave that filtering to the client.

## Subscribe from a client

A browser can subscribe over direct server-sent events or a direct WebSocket, and the `@cratis/arc` client subscribes through generated proxies over a multiplexed hub. [Subscribe to an observable query](subscribing-to-observable-queries.md) shows each one.

## Without decorators

`defineObservableQuery` takes an `observe` callback instead of a decorated method. This complete low-level example needs no build step on Node.js 22.19 or later, which strips types by default; run it with `node observable.ts` inside the workspace:

```typescript title="observable.ts"
import express from 'express';
import { z } from 'zod';
import { ArcServer, defineObservableQuery } from '@cratis/arc.core';
import { BehaviorSubject } from 'rxjs';
import { cratisArc } from '@cratis/arc.express';

const numbers = new BehaviorSubject<number[]>([1]);
const query = defineObservableQuery({
    name: 'Numbers',
    schema: z.object({}),
    observe: () => numbers
});
const server = new ArcServer({ observableQueries: [query] });
const app = express();
const adapter = cratisArc(server);
app.use(adapter);
const listener = app.listen(3000, '127.0.0.1');
adapter.injectWebSocket(listener);
let nextNumber = 2;
const timer = setInterval(() => numbers.next([nextNumber++]), 1000);

process.once('SIGINT', () => {
    clearInterval(timer);
    void (async () => {
        try {
            await adapter.close(listener); // Drain WebSockets and SSE, then close the listener.
        } finally { await server.dispose(); }
    })();
});
```

`curl http://127.0.0.1:3000/api/numbers` answers 200 with `data: [1]` or a later number. `observe` may resolve services through `currentServices()`.

## Recap

One route serves a snapshot and a stream. Return a source that has a current value when you have one, emit `undefined` for "nothing there", and let errors be errors. Paging and sorting apply to every emission; authorization applies once, when the subscription opens, and emission guards cover what changes after that. Filter rows by the caller inside the source.

## Next step

[Subscribe to an observable query](subscribing-to-observable-queries.md) connects a browser or the `@cratis/arc` client to the route you just declared.

## Related

- [Subscribe to an observable query](subscribing-to-observable-queries.md)
- [Multiplexed observable queries](observable-query-demultiplexer.md)
- [Observable emission guards](observable-query-emission-guards.md)
- [Testing observable queries](../testing/observable-queries.md)
- [MongoDB change streams](../mongodb/observing-collections.md)

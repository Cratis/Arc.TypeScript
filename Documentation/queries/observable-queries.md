---
title: Observable queries
description: Serve a current snapshot and live updates from one query route, choose a source, and subscribe over direct server-sent events or WebSockets.
---

A task board should update when someone adds a task, without the browser polling. An observable query serves the current snapshot on an ordinary GET and streams every change to subscribers, from the same route and the same pipeline.

## Declare an observable query

The [Tasks sample](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Tasks/Features/Tasks/Listing/Listing.ts) marks its live list with `{ observable: true }` and returns a source:

```typescript
@query({ observable: true }, service(Tasks))
static observeAllTasks(tasks: Tasks): BehaviorSubject<TaskItem[]> { return tasks.observeAll(); }
```

The sample's `Tasks` service keeps a `new BehaviorSubject<TaskItem[]>([])` from RxJS and calls `next(...)` whenever a task is registered. The `{ observable: true }` flag is required: it tells snapshots, server-sent events, WebSocket admission, introspection, and generated clients the query's contract before it runs.

## Choose a source

| Source | Snapshot behavior |
| --- | --- |
| RxJS `BehaviorSubject<T>` | Has a current value: GET answers 200 immediately, and new subscribers receive it first |
| RxJS `Subject<T>` or `Observable<T>` | No current value: GET answers 202 with `isReady: false`; `waitForFirstResult=true` subscribes until the first value |
| RxJS `ReplaySubject<T>` | No readable current value: GET answers 202 even after an emission; a waiting GET receives the buffered value |
| `AsyncIterable<T>` | No current value until the first item |
| `CurrentValueSubject<T>` (deprecated) | Legacy current/pending source; use RxJS `BehaviorSubject` or `Subject` instead |

A `BehaviorSubject` exposes its current value, including `undefined`; `Subject` and `ReplaySubject` do not. The core accepts structural subscribables and async iterables without loading RxJS at runtime, so RxJS is an optional peer dependency for consumers using only async iterables. A completed source before its first emission returns an error to a waiting GET; an errored source reports a query failure. Disconnecting cancels the subscription. The query method runs after authorization and validation, and its `context.signal` aborts when the subscription ends. Each subscription owns its own service scope; do not share scoped service instances across subscriptions.

## Read the snapshot and subscribe from the terminal

With the Tasks sample running:

```bash
curl http://127.0.0.1:3000/api/tasks/listing/observe-all-tasks
curl -N -H 'Accept: text/event-stream' http://127.0.0.1:3000/api/tasks/listing/observe-all-tasks
```

The first answers 200 with the current tasks in `data`. The second keeps the connection open and prints a `data: <query result JSON>` frame now, and another whenever you register a task. [Using observable queries with curl](using-observable-queries-with-curl.md) covers waiting for a first result and the error codes.

## Subscribe over direct server-sent events

In a browser on the same origin:

```javascript
const stream = new EventSource('/api/tasks/listing/observe-all-tasks');
stream.onmessage = event => console.log(JSON.parse(event.data).data);
// Call stream.close() when you no longer need updates.
```

A direct SSE frame is `data: <query result JSON>\n\n`, a full query result each time. Browser `EventSource` cannot set an `Authorization` header: authenticate with your host's session cookie, never with the `.cratis-identity` display cookie.

## Subscribe over a direct WebSocket

```javascript
const socket = new WebSocket(`ws://${location.host}/api/tasks/listing/observe-all-tasks`);
socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.type === 'Data') console.log(message.data.data);
    if (message.type === 'Pong') console.log('Pong at', message.timestamp);
};
socket.onopen = () => socket.send(JSON.stringify({ type: 'Ping', timestamp: Date.now() }));
// Call socket.close() when you no longer need updates.
```

Direct WebSocket frames are `{"type":"Data","data":<query result>}`; a `Ping` receives a `Pong` with the same timestamp. The standalone Node host accepts upgrades on its own; framework adapters need a separate mount, described in [WebSockets](../hosts/websockets.md).

## Use the installed client

The published `@cratis/arc` client subscribes through generated `ObservableQueryFor` proxies. Its default is the [multiplexed WebSocket hub](observable-query-demultiplexer.md). For the direct transports above, set these before subscribing:

```typescript
import { Globals } from '@cratis/arc';
import { QueryTransportMethod } from '@cratis/arc/queries';

Globals.queryDirectMode = true;
Globals.queryTransportMethod = QueryTransportMethod.ServerSentEvents; // or QueryTransportMethod.WebSocket
```

Generated proxies carry the exact query name. The [proxy generator](../proxy-generation/index.md) emits them for model-bound observable queries.

## Without decorators

`defineObservableQuery` takes an `observe` callback instead of a decorated method. This complete low-level example needs no build step on Node.js 26, which strips types by default; run it with `node observable.ts` inside the workspace:

```typescript title="observable.ts"
import express from 'express';
import { z } from 'zod';
import { ArcServer, defineObservableQuery } from '@cratis/arc.core';
import { BehaviorSubject } from 'rxjs';
import { mountExpress, mountExpressWebSockets } from '@cratis/arc.express';

const numbers = new BehaviorSubject<number[]>([1]);
const query = defineObservableQuery({
    name: 'Numbers',
    schema: z.object({}),
    observe: () => numbers
});
const server = new ArcServer({ observableQueries: [query] });
const app = express();
mountExpress(app, server);
const listener = app.listen(3000, '127.0.0.1');
mountExpressWebSockets(listener, server);
let nextNumber = 2;
const timer = setInterval(() => numbers.next([nextNumber++]), 1000);

process.once('SIGINT', () => {
    clearInterval(timer);
    void server.dispose().then(() => listener.close(), error => {
        console.error(error);
        process.exitCode = 1;
        listener.close();
    });
});
```

`curl http://127.0.0.1:3000/api/numbers` answers 200 with `data: [1]` or a later number. `observe` may resolve services through `currentServices()`.

## Related

- [Multiplexed observable queries](observable-query-demultiplexer.md)
- [Observable emission guards](observable-query-emission-guards.md)
- [Testing observable queries](../testing/observable-queries.md)
- [MongoDB change streams](../mongodb/observing-collections.md)

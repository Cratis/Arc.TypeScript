---
title: Stream an observable query
description: Define a current-value observable query, read its HTTP snapshot, and subscribe to direct SSE or WebSocket updates.
---

Use an observable query when callers need a current snapshot and updates from the same query route. This source preview supports HTTP snapshots and **direct SSE or WebSocket** in Express, Fastify, and Hono. Multiplexed hubs, revisions, transfer modes, and the query-health endpoint are **not implemented**. No package is published to npm yet.

## Define the source and mount the server

In the Arc for TypeScript workspace, put this in `observable.ts`. The example binds only to loopback.

```typescript title="observable.ts"
import express from 'express';
import { z } from 'zod';
import { ArcServer, CurrentValueSubject, defineObservableQuery } from '@cratis/arc.server';
import { mountExpress, mountExpressWebSockets } from '@cratis/arc.server.express';

const numbers = new CurrentValueSubject<number[]>([1]);
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
    listener.closeAllConnections();
    listener.close();
    void server.dispose();
});
```

Run `node --experimental-strip-types observable.ts` with Node.js 26 in the workspace. Then run `curl http://127.0.0.1:3000/api/numbers`. You receive a 200 query-result envelope with `data: [1]` (or a later number). If you construct `new CurrentValueSubject<number[]>()` instead, the same GET returns 202 with `isReady: false` until the first publication. A current value is explicitly tagged so even `undefined` can be distinguished from no value.

The source can also be an `AsyncIterable<T>` or an object with an RxJS-compatible `subscribe({ next, error, complete })` method returning an unsubscribe handle. A behavior subject exposing `getValue()` or `value` also supplies HTTP snapshots. Arc does not require RxJS at runtime. The `observe` callback runs after authorization and validation and may resolve services through `currentServices()`. Its `context.signal` is canceled when the subscription ends. Each subscription owns its own service scope; do not reuse scoped service instances across subscriptions. For per-emission authorization, register `ServiceToken<ObservableEmissionGuard>` services and list their tokens in `observableEmissionGuards`. Return `ObservableEmissionDecision.Allow`, `Suppress`, or `DenyAndTerminate`. A thrown guard denies and ends the subscription, including when evaluating a current HTTP snapshot.

## Subscribe to direct SSE

In the browser console at the same origin:

```javascript
const stream = new EventSource('/api/numbers');
stream.onmessage = event => console.log(JSON.parse(event.data).data);
// Call stream.close() when your component no longer needs updates.
```

A replaying source such as `CurrentValueSubject` first sends the current `[n]`, then a new full snapshot arrives once per second. A direct SSE frame is `data: <query result JSON>\n\n`, not a hub envelope. Set `Globals.queryDirectMode = true` and `Globals.queryTransportMethod = QueryTransportMethod.ServerSentEvents` before subscribing with the installed `@cratis/arc` client; its default is the WebSocket hub, which this server does not yet provide. To generate an `ObservableQueryFor` proxy, declare an explicit `clientOutput` contract on the definition before calling `exportClientManifest(server)`. The generated proxy supplies the exact fully qualified query name; its `subscribe()` uses the installed client runtime. The verified generated-client test uses an array of flat DTOs over direct SSE, not a hub. Browser EventSource cannot supply arbitrary authentication headers: use your host's trusted cookie/session authentication instead of treating the `.cratis-identity` display cookie as a credential.

## Subscribe to direct WebSocket

The same `mountExpressWebSockets(listener, server)` bridge accepts WebSocket upgrades on registered observable query routes. Fastify uses `mountFastifyWebSockets(app, server)` after `mountFastify`; Hono's Node server uses `mountHonoWebSockets(listener, server)` after `mountHono`. Each bridge checks the raw upgrade path before Arc sees it. Call `server.dispose()` during shutdown to close the upgraded sockets and their subscription scopes.

```javascript
const socket = new WebSocket(`ws://${location.host}/api/numbers`);
socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.type === 'Data') console.log(message.data.data);
    if (message.type === 'Pong') console.log('Pong at', message.timestamp);
};
socket.onopen = () => socket.send(JSON.stringify({ type: 'Ping', timestamp: Date.now() }));
// Call socket.close() when you no longer need updates.
```

Direct WebSocket frames contain `{"type":"Data","data":<query result>}`. Ping receives Pong with the same millisecond timestamp. For the installed client, set `Globals.queryDirectMode = true` and `Globals.queryTransportMethod = QueryTransportMethod.WebSocket` before subscribing.

For a pending source, `GET /api/numbers?waitForFirstResult=true` waits for its first emission. The default wait is 30 seconds; `waitForFirstResultTimeout` accepts a positive number of seconds up to 120. A timeout answers 408; completion before the first value answers 500. Without waiting, a pending source answers 202, not a failure. Invalid wait options answer 400. Booleans are case-insensitive (`True` works); unlike .NET, an unrecognized boolean is rejected rather than ignored. Arc on .NET currently accepts larger timeout values; this server bounds them to avoid retaining unlimited subscriptions. A 408 timeout and a 500 completed-without-value response retain their protocol-specific messages in production.

See [Capability reference](../reference/capabilities.md) for the remaining transport gaps, and [Bind query arguments](queries.md) for paging and sorting of emitted arrays.

---
title: Stream an observable query
description: Define a current-value observable query, read its HTTP snapshot, and subscribe over direct or multiplexed transports.
---

Use an observable query when callers need a current snapshot and updates from the same query route. This source preview supports HTTP snapshots, direct SSE/WebSocket, and multiplexed SSE/WebSocket hubs in Express, Fastify, and Hono. No package is published to npm yet.

## Define the source and mount the server

In the Arc for TypeScript workspace, put this in `observable.ts`. The example binds only to loopback.

```typescript title="observable.ts"
import express from 'express';
import { z } from 'zod';
import { ArcServer, CurrentValueSubject, defineObservableQuery } from '@cratis/arc.server';
import { mountExpress, mountExpressWebSockets } from '@cratis/arc.server.express';

const numbers = CurrentValueSubject.of<number[]>([1]);
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

Run `node --experimental-strip-types observable.ts` with Node.js 26 in the workspace. Then run `curl http://127.0.0.1:3000/api/numbers`. You receive a 200 query-result envelope with `data: [1]` (or a later number). If you construct `CurrentValueSubject.pending<number[]>()` instead, the same GET returns 202 with `isReady: false` until the first publication. A current value is explicitly tagged so even `undefined` can be distinguished from no value.

The source can also be an `AsyncIterable<T>` or an object with an RxJS-compatible `subscribe({ next, error, complete })` method returning an unsubscribe handle. A behavior subject exposing `getValue()` or `value` also supplies HTTP snapshots. Arc does not require RxJS at runtime. The `observe` callback runs after authorization and validation and may resolve services through `currentServices()`. Its `context.signal` is canceled when the subscription ends. Each subscription owns its own service scope; do not reuse scoped service instances across subscriptions. For per-emission authorization, register `ServiceToken<ObservableEmissionGuard>` services and list their tokens in `observableEmissionGuards`. Return `ObservableEmissionDecision.Allow`, `Suppress`, or `DenyAndTerminate`. A thrown guard denies and ends the subscription, including when evaluating a current HTTP snapshot.

## Subscribe to direct SSE

In the browser console at the same origin:

```javascript
const stream = new EventSource('/api/numbers');
stream.onmessage = event => console.log(JSON.parse(event.data).data);
// Call stream.close() when your component no longer needs updates.
```

A replaying source such as `CurrentValueSubject` first sends the current `[n]`, then a new full snapshot arrives once per second. A direct SSE frame is `data: <query result JSON>\n\n`, not a hub envelope. Set `Globals.queryDirectMode = true` and `Globals.queryTransportMethod = QueryTransportMethod.ServerSentEvents` before subscribing with the installed `@cratis/arc` client; its default is the WebSocket hub. To generate an `ObservableQueryFor` proxy, declare an explicit `clientOutput` contract on the definition before calling `exportClientManifest(server)`. The generated proxy supplies the exact fully qualified query name; its `subscribe()` uses the installed client runtime. Generated proxies are compiled and exercised over direct SSE; the installed client is also exercised over both hubs with the exact query name. Browser EventSource cannot supply arbitrary authentication headers: use your host's trusted cookie/session authentication instead of treating the `.cratis-identity` display cookie as a credential.

## Subscribe to direct WebSocket

`mountExpressWebSockets(listener, server)` accepts upgrades on registered query routes; Express HTTP middleware does not run for upgrades, so use Arc authentication or a trusted async `native` resolver. For Fastify, call `mountFastifyWebSockets(app, server)` **before** `mountFastify(app, server)` and `listen()`; Fastify hooks run, and `app.close()` disposes the sockets. For Hono, call `mountHono(app, server)`, then `const sockets = mountHonoWebSockets(app, server)` before `serve()`; call `sockets.injectWebSocket(listener)` after `serve()` and `await sockets.dispose()` on shutdown. Hono middleware runs for upgrades. See [Host Arc](host-integration.md#mount-observable-websockets-on-nodejs) for the trust boundaries.

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

## Share a multiplexed connection

One WebSocket carries many subscriptions at `/.cratis/queries/ws`. This works with the loopback example above, even without authentication:

```javascript
const hub = new WebSocket(`ws://${location.host}/.cratis/queries/ws`);
hub.onmessage = event => {
    const frame = JSON.parse(event.data);
    if (frame.type === 'Connected') {
        hub.send(JSON.stringify({ type: 'Subscribe', queryId: 'numbers', revision: 1,
            payload: { queryName: 'Numbers', transferMode: 'full' } }));
    }
    if (frame.type === 'QueryResult') console.log(frame.payload.data);
};
// To stop only this subscription:
// hub.send(JSON.stringify({ type: 'Unsubscribe', queryId: 'numbers', revision: 1 }));
```

The SSE hub uses `GET /.cratis/queries/sse` for its `Connected` stream and authenticated `POST /.cratis/queries/sse/subscribe` and `/unsubscribe` controls. It requires a **trusted authenticated principal** on both the stream and every control request; the anonymous example above cannot use it. Configure [authentication](validation-and-authorization.md) before selecting this transport. A control request from a different principal or tenant returns the same 404 as an unknown connection ID. The `.cratis-identity` display cookie is not an authentication credential.

The installed client's default is the multiplexed WebSocket hub. Set `Globals.queryDirectMode = false` and choose `Globals.queryTransportMethod` (`WebSocket` or `ServerSentEvents`). Its default transfer preference is `delta`: the first enumerable result carries full `data`, and later results carry `{ added, replaced, removed }` of full items **without** `data`. The installed `ObservableQueryFor.subscribe` callback does not reconstruct later arrays: its enumerable callback receives `data: []` alongside the raw change set. Choose `Globals.observableQueryTransferMode = 'full'` when the callback needs a full array on every update. An absent or unrecognized mode sends legacy full data plus a change set; scalar results always carry full data. The **property name** `id` is recognized case-insensitively; identity **values** compare by case and JSON primitive type (`"A"` differs from `"a"` and `1` differs from `"1"`). Missing or duplicate IDs use JSON set comparison. Order-only and duplicate-count-only changes are not representable in a change set.

Hub `Connected` advertises a 30-second keep-alive by default and subscription revisions. Configure `observableKeepAliveIntervalMs: 0` to disable keep-alive; otherwise each outbound frame reschedules the next idle ping. Revisions ignore stale or duplicate subscribes; unsubscribe tombstones live for two minutes (at most 1024 per connection by default). Limits are configurable through `ArcServerOptions`: by default there are 4096 subscriptions globally and per caller, 512 hub connections globally and per caller, 256 subscriptions per hub connection, and 256 queued inbound/outbound frames. An authorized caller can opt into `enableObservableHealth: true` to read its **own hub connections** at `/.cratis/queries/health`; this differs deliberately from .NET's anonymous, cross-caller health view and does not include direct connections.

## Wait for a snapshot

For a pending source, `GET /api/numbers?waitForFirstResult=true` waits for its first emission. The default wait is 30 seconds; `waitForFirstResultTimeout` accepts a positive number of seconds up to 120. A timeout answers 408; completion before the first value answers 500. Without waiting, a pending source answers 202, not a failure. Invalid wait options answer 400. Booleans are case-insensitive (`True` works); unlike .NET, an unrecognized boolean is rejected rather than ignored. Arc on .NET currently accepts larger timeout values; this server bounds them to avoid retaining unlimited subscriptions. A 408 timeout and a 500 completed-without-value response retain their protocol-specific messages in production.

See [Capability reference](../reference/capabilities.md) for the remaining transport gaps, and [Bind query arguments](queries.md) for paging and sorting of emitted arrays.

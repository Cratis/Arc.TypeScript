---
title: Stream a query over Server-Sent Events
description: Define a current-value observable query, read its HTTP snapshot, and subscribe to direct SSE updates.
---

Use an observable query when callers need a current snapshot and updates from the same query route. This source preview supports HTTP snapshots and **direct SSE** in Express, Fastify, and Hono. WebSockets, multiplexed hubs, revisions, transfer modes, emission guards, and the query-health endpoint are **not implemented**. No package is published to npm yet.

## Define the source and mount the server

In the Arc for TypeScript workspace, put this in `observable.ts`. The example binds only to loopback.

```typescript title="observable.ts"
import express from 'express';
import { z } from 'zod';
import { ArcServer, CurrentValueSubject, defineObservableQuery } from '@cratis/arc.server';
import { mountExpress } from '@cratis/arc.server.express';

const numbers = new CurrentValueSubject<number[]>({ hasValue: true, value: [1] });
const query = defineObservableQuery({
    name: 'Numbers',
    schema: z.object({}),
    observe: () => numbers
});
const server = new ArcServer({ observableQueries: [query] });
const app = express();
mountExpress(app, server);
const listener = app.listen(3000, '127.0.0.1');
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

The source can also be an `AsyncIterable<T>` or an object with an RxJS-compatible `subscribe({ next, error, complete })` method returning an unsubscribe handle. Arc does not require RxJS at runtime. The `observe` callback runs after authorization and validation and may resolve services through `currentServices()`. Its `context.signal` is canceled when the subscription ends. Each subscription owns its own service scope; do not reuse scoped service instances across subscriptions.

## Subscribe to direct SSE

In the browser console at the same origin:

```javascript
const stream = new EventSource('/api/numbers');
stream.onmessage = event => console.log(JSON.parse(event.data).data);
// Call stream.close() when your component no longer needs updates.
```

The first message contains the current `[n]`, then a new full snapshot arrives once per second. A direct SSE frame is `data: <query result JSON>\n\n`, not a hub envelope. The installed `@cratis/arc` client can use this route when its global transport is set to direct Server-Sent Events; no client changes are needed. To generate an `ObservableQueryFor` proxy, declare an explicit `clientOutput` contract on the definition before calling `exportClientManifest(server)`. The generated proxy supplies the exact fully qualified query name; its `subscribe()` uses the installed client runtime. The verified generated-client test uses an array of flat DTOs over direct SSE, not a hub. Browser EventSource cannot supply arbitrary authentication headers: use your host's trusted cookie/session authentication instead of treating the `.cratis-identity` display cookie as a credential.

For a pending source, `GET /api/numbers?waitForFirstResult=true` waits for its first emission. The default wait is 30 seconds; `waitForFirstResultTimeout` accepts a positive number of seconds up to 120. A timeout answers 408; completion before the first value answers 500. Without waiting, a pending source answers 202, not a failure. Invalid wait options answer 400. Arc on .NET currently accepts larger timeout values; this server bounds them to avoid retaining unlimited subscriptions.

See [Capability reference](../reference/capabilities.md) for the remaining transport gaps, and [Bind query arguments](queries.md) for paging and sorting of emitted arrays.

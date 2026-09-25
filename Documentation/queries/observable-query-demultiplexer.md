---
title: Multiplexed observable queries
description: Carry many observable-query subscriptions over one WebSocket or server-sent-events hub connection, choose a transfer mode, and size the hub's limits.
---

A dashboard with ten live widgets should not open ten sockets. The multiplexed hub carries every subscription from one client over a single connection, and it is the default transport of the published `@cratis/arc` client.

The plain `@cratis/arc` client uses the WebSocket hub by default. The `<Arc>` provider from `@cratis/arc.react` uses the SSE hub by default. Both work with anonymous callers; every subscription still runs through query authorization.

## The WebSocket hub

The hub lives at `/.cratis/queries/ws`. After `Connected`, the client subscribes by query name:

```javascript
const hub = new WebSocket(`ws://${location.host}/.cratis/queries/ws`);
hub.onmessage = event => {
    const frame = JSON.parse(event.data);
    if (frame.type === 'Connected') {
        hub.send(JSON.stringify({ type: 'Subscribe', queryId: 'tasks', revision: 1,
            payload: { queryName: 'Tasks.Listing.TaskItem.observeAllTasks', transferMode: 'full' } }));
    }
    if (frame.type === 'QueryResult') console.log(frame.payload.data);
};
// To stop only this subscription:
// hub.send(JSON.stringify({ type: 'Unsubscribe', queryId: 'tasks', revision: 1 }));
```

`queryName` is the query's full identity; see [Endpoint mapping](../core/endpoint-mapping.md#the-convention). Each subscription is authorized independently through the query pipeline; an unauthorized query receives an `Unauthorized` frame.

## The server-sent-events hub

The SSE hub uses `GET /.cratis/queries/sse` for its stream, plus `POST /.cratis/queries/sse/subscribe` and `/unsubscribe` controls. The stream opens with a `Connected` frame whose payload is the connection ID; every control request names it. The stream can be opened anonymously.

Browser `EventSource` sends same-origin cookies but cannot set an `Authorization` header. If your queries require sign-in, use your application's real session cookie on the stream and controls; the `.cratis-identity` display cookie is not a credential. SSE controls require `application/json` (optionally `charset=utf-8`) and reject an untrusted browser `Origin` with 403. Same-origin is allowed by default; configure `query.allowedOrigins` for trusted cross-origin frontends.

### Response headers

The hub stream, and a direct SSE stream for one query (`GET` on the query route with `Accept: text/event-stream`), answer 200 with these headers:

| Header | Value |
| --- | --- |
| `Content-Type` | `text/event-stream; charset=utf-8` |
| `Cache-Control` | `no-cache` |
| `Connection` | `keep-alive` |
| `X-Accel-Buffering` | `no`, which asks a buffering reverse proxy to pass each frame through as it is written |
| `X-Correlation-ID` | The request's correlation ID, under the header name set by `correlationId.httpHeader` |

`no-cache` lets a cache store the response only if it revalidates before reuse. Arc sends `Cache-Control: no-store` on HTTP `QUERY` responses and `/.cratis/me`, not on SSE streams. If a proxy or CDN in front of Arc must never store a stream, configure that in the proxy.

### Who can control a connection

The connection ID is crypto-random. A control request must also come from the caller that opened the connection:

- It must resolve to the same tenant and the same authentication state. Anonymous callers cannot control authenticated connections, and authenticated callers cannot control anonymous ones.
- For an authenticated connection, it must carry the same principal ID.
- For an anonymous connection, it must come from the same peer address as the stream. Arc for TypeScript adds this check; Arc on .NET does not have it. When neither request has a peer address, the check cannot tell anonymous callers in the same tenant apart, so anyone who learns the connection ID can control the connection.

An unknown connection, or one the caller does not own, answers 404. A query the caller may not access answers 401 with an `Unauthorized` frame. The peer-address check is not authentication: behind a shared proxy, every client has the proxy's address.

### Per-caller budgets

Every hub connection and every live subscription counts against a per-caller budget. Arc decides who the caller is from the request:

| Caller | Shares a budget with |
| --- | --- |
| Authenticated | Requests with the same principal ID in the same tenant |
| Anonymous, with a peer address | Anonymous requests from the same address in the same tenant |
| Anonymous, without a peer address | Every anonymous request without an address in the same tenant |

Two options set the budgets:

| Option | Default | Counts |
| --- | --- | --- |
| `query.maxObservableHubConnectionsPerCaller` | `512`, the same as `query.maxObservableHubConnections` | Open WebSocket and SSE hub connections |
| `query.maxObservableSubscriptionsPerCaller` | `4096`, the same as `query.maxObservableSubscriptions` | Live subscriptions, direct or on a hub, including ones still opening |

With the defaults, one caller can take the whole global capacity. Lower both for an internet-facing host. Opening an SSE stream or SSE hub over budget answers 503 with `Retry-After: 1`, and a WebSocket hub over budget is refused with 503 during the upgrade, or closed with code 1013 if the budget ran out while it connected. A hub subscription over budget receives an `Error` frame, and its SSE control request answers 503.

### Peer addresses and proxies

Where the peer address comes from depends on the host:

- **Express, Fastify, and Hono on the Node server** read it from the TCP socket, unless the adapter's native callback returns a `remoteAddress`.
- **The standalone host** (`app.run()`, `runArc`, and `createArcNodeHandler`) does not read the socket for HTTP requests, so SSE streams and controls have no peer address unless its `native` option returns `remoteAddress`. Its WebSocket upgrades fall back to the socket address.
- **Fetch API hosts** (`app.fetch`, `app.handle`, and `server.handle`) have no socket. Pass `remoteAddress` in the native context.

Arc never reads `X-Forwarded-For` or `Forwarded`. Behind a reverse proxy, the socket address is the proxy's, so all anonymous clients behind it share one budget, and the peer-address check only shows that a control request came through the same proxy. A low per-caller cap then throttles those clients together. To budget them one by one, validate the forwarding header against your trusted proxy chain in the native callback and return the client address as `remoteAddress`. [Native principal](../hosts/native-principal.md) describes the callback, and [WebSockets](../hosts/websockets.md) shows a trusted-proxy check for upgrades.

## Configure the installed client

```typescript
import { Globals } from '@cratis/arc';
import { QueryTransportMethod } from '@cratis/arc/queries';

Globals.queryDirectMode = false;
Globals.queryTransportMethod = QueryTransportMethod.WebSocket; // or QueryTransportMethod.ServerSentEvents
Globals.observableQueryTransferMode = 'full';
```

## Transfer modes

| Mode | What each result carries |
| --- | --- |
| `full` | The complete snapshot every time |
| `delta` (client default) | The first enumerable result carries full `data`; later results carry `{ added, replaced, removed }` of full items **without** `data` |
| Absent or unrecognized | Full data plus a change set (legacy) |

Scalar results always carry full data. The installed client's `ObservableQueryFor.subscribe` callback does not rebuild arrays from deltas: its callback receives `data: []` next to the raw change set. Choose `full` when the callback needs the whole array on every update.

Items are matched by an `id` property; the property name is matched case-insensitively, while identity values compare by case and JSON type (`"A"` differs from `"a"`, and `1` differs from `"1"`). Items with missing or duplicate IDs fall back to JSON set comparison. A change set cannot represent order-only or duplicate-count-only changes.

## Revisions and keep-alive

`Connected` advertises revisions and a keep-alive interval, 30 seconds by default. Each outbound frame reschedules the next idle ping; `query: { keepAliveIntervalMs: 0 }` disables keep-alive. Positive safe-integer revisions supersede legacy subscribes and reject stale or duplicate operations. Unsubscribe tombstones live for two minutes, at most 1024 per connection by default.

## Limits

By default the server allows 4096 subscriptions globally and per caller, 512 hub connections globally and per caller, 256 subscriptions per hub connection, and 256 queued inbound and outbound frames. Per-caller limits default to the global ones, so one caller can exhaust capacity: set lower `query.maxObservableSubscriptionsPerCaller` and `query.maxObservableHubConnectionsPerCaller` for internet-facing hosts. [Per-caller budgets](#per-caller-budgets) explains how Arc tells callers apart. `query.observableShutdownTimeoutMs` (10 seconds) bounds hub and direct WebSocket cleanup at shutdown. All limits are listed in [Configuration](../configuration/index.md#observable-query-limits).

## Related

- [Observable queries](observable-queries.md)
- [Query health](query-health.md)
- [WebSockets](../hosts/websockets.md)

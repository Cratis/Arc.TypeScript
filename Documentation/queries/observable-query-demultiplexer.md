---
title: Multiplexed observable queries
description: Carry many observable-query subscriptions over one WebSocket or server-sent-events hub connection, choose a transfer mode, and size the hub's limits.
---

A dashboard with ten live widgets should not open ten sockets. The multiplexed hub carries every subscription from one client over a single connection, and it is the default transport of the published `@cratis/arc` client.

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

The SSE hub uses `GET /.cratis/queries/sse` for its `Connected` stream, plus `POST /.cratis/queries/sse/subscribe` and `/unsubscribe` controls. It requires a **trusted authenticated principal** on the stream and on every control request; anonymous callers cannot use it, which differs from Arc on .NET. Browser `EventSource` sends same-origin cookies but cannot set an `Authorization` header, so authenticate the stream with your application's real session cookie and send the same cookie with the control requests. A control request from a different principal or tenant returns the same 404 as an unknown connection ID; subscribing to an unauthorized query answers 401. The `.cratis-identity` display cookie is not a credential.

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

By default the server allows 4096 subscriptions globally and per caller, 512 hub connections globally and per caller, 256 subscriptions per hub connection, and 256 queued inbound and outbound frames. Per-caller limits default to the global ones, so one caller can exhaust capacity: set lower `query.maxObservableSubscriptionsPerCaller` and `query.maxObservableHubConnectionsPerCaller` for internet-facing hosts. `query.observableShutdownTimeoutMs` (10 seconds) bounds hub and direct WebSocket cleanup at shutdown. All limits are listed in [Configuration](../configuration/index.md#observable-query-limits).

## Related

- [Observable queries](observable-queries.md)
- [Query health](query-health.md)
- [WebSockets](../hosts/websockets.md)

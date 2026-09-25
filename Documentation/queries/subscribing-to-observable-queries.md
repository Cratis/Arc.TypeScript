---
title: Subscribe to an observable query
description: Receive live updates from an observable query over direct server-sent events, a direct WebSocket, or the installed @cratis/arc client and its multiplexed hub.
---

Your server already streams changes from an observable query. Now a client has to listen. Pick the transport that matches the client you have: a browser `EventSource`, a raw WebSocket, or the `@cratis/arc` client with generated proxies.

## Before you start

- A running Arc server that serves an observable query. The examples use the Tasks sample on `127.0.0.1:3000` and its `/api/tasks/listing/observe-all-tasks` route; [Get started](../getting-started/index.md) shows how to run it. Replace the route with your own query's route from `/.cratis/queries`.
- To check the route from a terminal first, follow [Using observable queries with curl](using-observable-queries-with-curl.md).

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

The published `@cratis/arc` client subscribes through generated `ObservableQueryFor` proxies over the [multiplexed hub](observable-query-demultiplexer.md). The plain client defaults to the WebSocket hub. The `<Arc>` provider from `@cratis/arc.react` defaults to the SSE hub instead; both accept anonymous connections. Each subscription still passes through query authorization, so an anonymous caller can only observe queries that permit anonymous access. The default `<Arc>` configuration works for the [Tasks browser example](../getting-started/continue-in-the-browser.md) without switching transports.

For the direct transports above, set these before subscribing:

```typescript
import { Globals } from '@cratis/arc';
import { QueryTransportMethod } from '@cratis/arc/queries';

Globals.queryDirectMode = true;
Globals.queryTransportMethod = QueryTransportMethod.ServerSentEvents; // or QueryTransportMethod.WebSocket
```

Generated proxies carry the exact query name. The [proxy generator](../proxy-generation/index.md) emits them for model-bound observable queries.

## When a subscription ends

Every transport ends the same way: when the client closes or disconnects, when the source completes or errors, or when an [emission guard](observable-query-emission-guards.md) denies an emission. [Subscription lifetime](observable-queries.md#subscription-lifetime) describes what Arc cleans up.

## Next steps

- [Multiplexed observable queries](observable-query-demultiplexer.md) explains the hubs that generated clients use.
- [Frontend usage](../proxy-generation/frontend-usage.md) shows generated proxies in a React application.
- [Testing observable queries](../testing/observable-queries.md) collects emissions in a spec, without a transport.

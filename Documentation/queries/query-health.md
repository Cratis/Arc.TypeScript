---
title: Query health
description: Opt in to a caller-scoped observable query that reports the caller's own hub connections, subscriptions, and query groups.
---

When a live widget stops updating, the first question is whether its subscription still exists. The query health endpoint answers that for the caller asking, and nobody else.

## Turn it on

```typescript
const builder = ArcApplication.createBuilder({ query: { enableObservableHealth: true }, authentication: [/* verified handlers */] });
```

`query.enableObservableHealth: true` registers `/.cratis/queries/health` as an observable query for GET and `QUERY`. It requires authentication.

## What it reports

An authenticated caller sees only its own tenant and principal's **hub** connections, their subscription counts, and query groups. Direct SSE and WebSocket connections and remote IP addresses are not included. Other callers' unchanged snapshots are not emitted to you, and your own bursts are coalesced. The built-in health query is not emitted as an application proxy in the client manifest.

:::caution[A deliberate difference from Arc on .NET]
Arc on .NET exposes a broader, anonymous, cross-caller health view. Arc for TypeScript keeps it disabled by default and scoped to the caller, because connection metadata is sensitive.
:::

## Related

- [Multiplexed observable queries](observable-query-demultiplexer.md)
- [Configuration](../configuration/index.md#observable-query-limits)

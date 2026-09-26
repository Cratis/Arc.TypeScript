---
title: ARCCHR0003 — Reactor must not reach the default event log
description: Return Chronicle events from a reactor instead of appending to its own default log.
---

A reactor can return events to Chronicle. Directly calling `this.store.eventLog.append(...)` or
`appendMany(...)` writes outside that return path. The rule also finds appends through a local `store`
obtained with `await this.runtime.getStore(...)`. It does not report reads, outbox writes, stores
chosen through another client, callbacks inside handlers, or helper calls. The `reactor` decorator
must come from `@cratis/chronicle/reactors`.

```ts
// Instead of: await this.store.eventLog.append(id, new FollowedUp());
return new FollowedUp();
```

This is an analog of the .NET warning, not a complete data-flow analysis. Other direct SDK appends
still need review. [Chronicle code analysis](../chronicle/code-analysis.md) maps the other diagnostics.

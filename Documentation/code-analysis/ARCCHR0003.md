---
title: ARCCHR0003 — Reactor must not reach the default event log
description: Return Chronicle events from a reactor instead of appending to its own default log.
---

A reactor can return events to Chronicle. The rule finds direct `this.<field>.eventLog.append(...)`
or `appendMany(...)` (including `.transactional`) when the field is initialized or assigned earlier
in the same method with `this.client.getEventStore(...)` or `this.runtime.getStore(...)`. It does not report fields initialized
from `other.getEventStore('elsewhere')`, uninitialized store fields, reads, outbox writes, callbacks
inside handlers, or helper calls. The `reactor` decorator must come from `@cratis/chronicle` or
`@cratis/chronicle/reactors`. The SDK has no reactor DI ownership contract: even for a matching
`this.client`/`this.runtime` field the rule cannot prove that client or store belongs to the reactor.

```ts
// Instead of: await this.store.eventLog.append(id, new FollowedUp());
return new FollowedUp();
```

This is an analog of the .NET warning, not a complete data-flow analysis. Other direct SDK appends
still need review. [Chronicle code analysis](../chronicle/code-analysis.md) maps the other diagnostics.

---
title: ARCCHR0007 — Command handler must not append directly to the event log
description: Return events from a Chronicle-backed command handler to preserve its append pipeline.
---

A decorated command's `handle()` should return events for the Chronicle integration to append.
Directly calling `this.store.eventLog.append(...)` or `appendMany(...)` bypasses the returned-event
batch. The rule also detects a local `store` obtained with `await this.runtime.getStore(...)`.
It does not follow helpers, callbacks, or arbitrary stores and does not forbid standalone Arc commands
from returning non-event responses.

```ts
// Instead of: await this.store.eventLog.append(this.id, new Registered());
return new Registered();
```

This is an analog of the .NET warning.
[Transactional commands](../chronicle/commands/transactional-commands.md#what-is-outside-the-batch)
explains the batch boundary.

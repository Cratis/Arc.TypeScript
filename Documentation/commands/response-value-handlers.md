---
title: Response value handlers
description: Return several values from a command with tuple(), send one to the client, and process the others on the server with scoped response value handlers.
---

A command sometimes decides more than its client needs to see: an audit entry, a notification to queue, or an event to append. Performing those effects inside `handle()` mixes the decision with the plumbing. Instead, return them next to the response and let a **response value handler** process each one on the server.

## Return a tuple

```typescript
import { field } from '@cratis/fundamentals';
import {
    command, commandResponseValueHandler, injectable, tuple,
    type CommandContext, type CommandResponseValueHandler
} from '@cratis/arc.core';

export class AuditEntry {
    constructor(readonly text: string) {}
}

export class AuditLog {
    readonly entries: string[] = [];
    record(correlationId: string, text: string): void { this.entries.push(`${correlationId}: ${text}`); }
}

@commandResponseValueHandler()
@injectable(AuditLog)
export class AuditEntryHandler implements CommandResponseValueHandler {
    constructor(private readonly log: AuditLog) {}

    canHandle(_context: CommandContext, value: unknown): boolean { return value instanceof AuditEntry; }

    handle(context: CommandContext, value: unknown): void {
        this.log.record(context.correlationId, (value as AuditEntry).text);
    }
}

@command()
export class CloseTask {
    @field(String) id!: string;

    handle() {
        return tuple({ id: this.id }, new AuditEntry(`Closed ${this.id}`));
    }
}
```

Register `AuditLog` with `builder.services.addSingleton(AuditLog)` and add or discover the command and the handler. `POST /api/close-task` with `{ "id": "a1" }` answers 200 with `"response":{"id":"a1"}`; the client never sees the audit entry, and `AuditLog` has recorded it.

## How Arc sorts the values

1. Arc flattens branded nested tuples and `response(...)` branches, in order.
2. For each value, it asks every registered handler's `canHandle(context, value)`. Every matching handler runs, in deterministic name order.
3. A value no handler accepts is a candidate client response. **At most one** such value is allowed; two unhandled values fail the command instead of returning an array.
4. Ordinary arrays are not flattened: an array is one value.

A handler's `handle(context, value)` may return `rejected(...)` or `denied(...)` to fail the command, but it must not return a client response. It runs in the command's service scope and reads the [`CommandContext`](command-context.md): the command, key, values, correlation ID, principal, tenant, allowed severity, and signal. Set `incompatibleWithOperations: true` on a handler whose effects cannot be combined with [command operations](operations/index.md); Arc then rejects the combination before any effect.

## Register a handler

- Mark the class `@commandResponseValueHandler()` and add it with `builder.add(...)` or `builder.discover(...)`. It is registered as scoped.
- Or register its token in `builder.services` and call `builder.addCommandResponseValueHandler(token)`.
- For a low-level `ArcServer`, list tokens in the `commandResponseValueHandlers` option.

The experimental [Chronicle integration](../chronicle/commands/index.md) uses this mechanism to append returned events.

## Related

- [Command outcomes](command-outcomes.md)
- [Command operations](operations/index.md)

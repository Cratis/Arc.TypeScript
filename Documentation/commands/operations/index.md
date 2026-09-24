---
title: Command operations
description: Return server-side operations from a command so Arc executes them in order and attempts compensation when the change did not commit.
---

A command that sends a notification after saving has two ways to fail: the save, and the send. Written inline, the handler has to catch, undo, and report each combination itself. A **command operation** lets `handle()` declare *what* should happen, and Arc coordinates the execution and its recovery.

## Declare and return an operation

This example records calls in memory to make the order visible; replace the recorder with a real service before using it for business effects.

```typescript
import { field } from '@cratis/fundamentals';
import { CommandOperation, command, tuple } from '@cratis/arc.core';

const calls: string[] = [];

class Notify extends CommandOperation {
    execute(signal: AbortSignal): void {
        if (signal.aborted) throw signal.reason;
        calls.push('notify');
    }

    compensate(_failure: unknown, signal: AbortSignal): void {
        if (signal.aborted) throw signal.reason;
        calls.push('undo notification');
    }
}

@command()
class SendNotification {
    @field(String) id!: string;

    handle() {
        return tuple({ id: this.id }, new Notify());
    }
}
```

Executed through Arc, `POST /api/send-notification` with `{ "id": "visible" }` answers `"response":{"id":"visible"}`, and `calls` holds `notify`. The client never receives the operation. A direct call to `handle()` in your own code only returns the declaration; nothing executes.

## How Arc runs operations

1. Arc validates every declaration and resolves every service dependency before entering the first operation.
2. It runs the operations in order and records each invocation before calling `execute`.
3. On failure it completes execution scopes first, then considers compensation in reverse order, including the operation that threw.
4. Compensation uses a separate, shared cooperative timeout, `commandCompensationTimeoutMs` (30,000 ms by default), not the request's cancelled signal. Arc cannot stop a callback that ignores its signal; a compensator that finishes after the budget is reported as `BudgetExpired`.

Use `operations(first, second)` for an explicit batch. A plain array is **not** a batch.

## Know the limits

Arc provides no distributed transaction, automatic retries, durable recovery journal, or crash recovery. A successful compensation callback is not proof that an external change was undone. Operations that need those guarantees need their own durable workflow. Returning Chronicle events together with operations is rejected before either effect runs.

## Continue

- [Implementing operations](implementing.md): dependencies, commit participants, and the flat command boundary.
- [Operations reference](reference.md): types, dispositions, outcomes, and test assertions.
- [Command outcomes](../command-outcomes.md) for ordinary responses and rejection without operations.

---
title: Declare command operations
---

Return a `CommandOperation` when a command decides *what* should happen but wants Arc to coordinate the effect and its recovery. A direct call to `handle()` only returns the declaration. Execute the command through Arc to run the operation.

This decorated-command example records calls in memory to make the order visible; replace that recorder with a real service before using it for business effects. The [low-level operation specification](../../Source/Arc.Core/for_ArcServer/given/an_operation_command.ts) uses `defineCommand` instead.

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

The client receives `{ id: 'visible' }`, not the operation. Use `operations(first, second)` for an explicit batch; a plain array is **not** a batch. Arc validates all declarations and service dependencies before entering the first operation, runs them in order, and records each invocation before calling `execute`. On failure it completes scopes first, then considers compensation in reverse order, including the operation that threw. Compensation uses a separate, shared cooperative timeout (`commandCompensationTimeoutMs`, 30,000 ms by default), not the request's canceled signal. It cannot force a callback to stop if it ignores that signal. A compensator that finishes after the budget expires is reported as `BudgetExpired`, not `Completed`, even if it returns normally.

For service dependencies, declare `executeDependencies` and `compensateDependencies` as token arrays on the operation; methods receive the execution signal (or failure and cleanup signal) followed by those resolved dependencies. Both method signatures must have exactly the declared number of parameters; default and rest parameters are unsupported because they do not provide a reliable parameter count. Arc resolves both sets before starting any operation. Do not capture a request-scoped service in the operation's constructor.

## Report whether the business change committed

Without a scope, Arc treats the batch as `NoCommit`. When a scope participates, implement `CommandOperationExecutionScope`: set `isCommitParticipant`, and report `getCommitDisposition(context)` from the underlying storage boundary, including after `complete()` throws. At most one participant may coordinate a deferred commit. Other scopes must opt in with `isCommitParticipant: false`; that promises they do not commit business changes. Arc rejects undeclared scopes rather than treating them as safe.

A known `NoCommit` or `NotCommitted` failure allows attempted compensation. `Committed` suppresses it. `Unknown` or `Mixed` never becomes a success or an automatic reversal. Do not use `result.isSuccess` to guess commitment; a network error after a write may mean the server committed but the acknowledgment was lost. Arc provides no distributed transaction, automatic retries, durable recovery journal, or crash recovery. Operations that need those guarantees require their own durable workflow.

Direct-call `CommandResult.recovery` and `.operationOutcomes` describe what the server observed, including missing or timed-out compensation. They are intentionally absent from HTTP JSON. A successful compensation callback is not proof that an external change was undone. Avoid returning secrets or operation payloads in the client response.

Operations require a flat command boundary: a nested child cannot return operations, and a parent that has attempted a nested command cannot return operations, even if the child's failed result was ignored. A nested Arc command inside an operation is also unsupported. Return another declaration instead. The [command outcomes guide](command-outcomes.md) covers ordinary responses and rejection without operations.

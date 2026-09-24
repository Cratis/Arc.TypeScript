---
title: Implementing operations
description: Give operations service dependencies, report whether the business change committed, and stay within the flat command boundary Arc can recover.
---

An operation is a small class extending `CommandOperation`. This page covers what you need beyond the basic example in [Command operations](index.md): services, commit facts, and the boundary Arc can coordinate.

## Resolve services

Declare `executeDependencies` and `compensateDependencies` as token arrays on the operation. `execute` receives the execution signal followed by the resolved execute dependencies; `compensate` receives the failure and a cleanup signal followed by the resolved compensate dependencies:

```typescript
class Notify extends CommandOperation {
    readonly executeDependencies = [Mailer] as const;
    readonly compensateDependencies = [Mailer] as const;

    constructor(private readonly to: string) { super(); }

    async execute(signal: AbortSignal, mailer: Mailer): Promise<void> {
        await mailer.send(this.to, signal);
    }

    async compensate(_failure: unknown, signal: AbortSignal, mailer: Mailer): Promise<void> {
        await mailer.retract(this.to, signal);
    }
}
```

This excerpt assumes an application `Mailer` class with `send` and `retract` methods, registered with `builder.services.addSingleton(Mailer)`, and `CommandOperation` imported from `@cratis/arc.core`. Both method signatures must have exactly the declared number of parameters; default and rest parameters are not supported, because they do not give a reliable parameter count. Arc resolves both sets before starting any operation. Do not capture a request-scoped service in the operation's constructor.

## Report whether the business change committed

Compensation is only safe when Arc knows the business change did not commit. Without a participating scope, Arc treats the batch as `NoCommit`.

When a low-level command has [execution scopes](../command-execution-scopes.md), each scope must declare its role by implementing `CommandOperationExecutionScope`:

- Set `isCommitParticipant: true` on the one scope that commits business changes, and report `getCommitDisposition(context)` from the underlying storage boundary, including after `complete()` throws. At most one participant may coordinate a deferred commit.
- Set `isCommitParticipant: false` on every other scope. That promises it does not commit business changes.
- Arc rejects scopes that do not declare either, rather than treating them as safe.

| Disposition | What Arc does on failure |
| --- | --- |
| `NoCommit`, `NotCommitted` | Attempts compensation |
| `Committed` | Suppresses compensation |
| `Unknown`, `Mixed` | Never turns it into success or an automatic reversal; recovery is indeterminate |

Do not use `result.isSuccess` to guess commitment: a network error after a write may mean the server committed but the acknowledgment was lost.

## Stay within a flat boundary

- A nested child command cannot return operations.
- A parent that has attempted a nested command cannot return operations, even if it ignored the child's failed result.
- A nested Arc command inside an operation is not supported. Return another declaration instead.

## Inspect what happened

Direct calls expose `CommandResult.recovery` and `CommandResult.operationOutcomes`, which describe what the server observed, including missing or timed-out compensation. They are intentionally absent from HTTP JSON. Avoid returning secrets or operation payloads in the client response. The [reference](reference.md) lists their fields.

## Related

- [Operations reference](reference.md)
- [Testing commands](../../testing/commands.md#assert-operations)

---
title: Operations reference
description: The CommandOperation contract, commit dispositions, recovery summaries, operation outcomes, the compensation option, and the scenario assertions for operations.
---

All types are exported from `@cratis/arc.core`; the assertions come from `@cratis/arc.testing`.

## CommandOperation

| Member | Required | Meaning |
| --- | --- | --- |
| `execute(signal, ...dependencies)` | Yes | Perform the effect; may return a promise |
| `compensate(failure, signal, ...dependencies)` | No | Undo the effect after a known uncommitted failure |
| `executeDependencies` | No | Tokens resolved and passed to `execute`, in order |
| `compensateDependencies` | No | Tokens resolved and passed to `compensate`, in order |

`operations(first, second, ...)` creates an explicit `CommandOperations` batch. Return operations from `handle()`, alone or inside `tuple(...)`.

## CommandOperationExecutionScope

Extends `CommandExecutionScope` (`begin`, `complete`) with:

| Member | Meaning |
| --- | --- |
| `isCommitParticipant` | `true` for the one scope that commits business changes; `false` promises the scope commits nothing |
| `getCommitDisposition(context)` | The authoritative `CommandCommitDisposition`, also after `complete()` throws |

## CommandCommitDisposition

| Value | Meaning | Compensation |
| --- | --- | --- |
| `NoCommit` | No participant commits business changes | Attempted |
| `NotCommitted` | The participant knows nothing committed | Attempted |
| `Committed` | The participant committed | Suppressed |
| `Unknown` | The participant cannot tell | Not attempted; recovery is indeterminate |
| `Mixed` | Some changes committed and some did not | Not attempted; recovery is indeterminate |

## CommandRecoverySummary (`result.recovery`)

| Field | Meaning |
| --- | --- |
| `commitDisposition` | The disposition Arc used |
| `status` | `NotNeeded`, `Completed`, `Incomplete`, `Suppressed`, or `Indeterminate` |
| `startedCount` | Operations entered |
| `completedCount` | Operations whose `execute` finished |
| `compensatedCount` | Compensations that finished |
| `failedCompensationCount` | Compensations that threw |
| `uncompensatedCount` | Entered operations left without completed compensation |

## CommandOperationOutcome (`result.operationOutcomes`)

| Field | Meaning |
| --- | --- |
| `invocationIndex` | Position in the executed order |
| `operationType` | The operation class name |
| `executionCompleted` | Whether `execute` finished |
| `compensation` | `NotNeeded`, `Completed`, `Failed`, `NotAvailable`, `BudgetExpired`, or `Suppressed` |
| `compensationFailure` | A description when compensation failed |

`recovery` and `operationOutcomes` are available on direct-call results only; they are never serialized to HTTP JSON.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `commandCompensationTimeoutMs` | `30000` | Shared cooperative budget for all compensation in one command |

## Scenario assertions

`CommandScenario` results offer:

| Assertion | Passes when |
| --- | --- |
| `shouldHaveExecutedOperation(Type)` | An operation of that type finished `execute` |
| `shouldHaveCompensatedOperation(Type)` | An operation of that type finished `compensate` |
| `shouldHaveNoOperationInvocations()` | No operation was entered, not even partially |
| `shouldHaveIndeterminateRecovery()` | The recovery status is `Indeterminate`, as after an `Unknown` or `Mixed` disposition |

These inspect real pipeline observations, not simulated work. See [Testing commands](../../testing/commands.md#assert-operations).

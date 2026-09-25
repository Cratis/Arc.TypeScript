---
title: Transactional commands
description: How returned events from a command and its nested commands join one event-log batch, when the batch is sent or discarded, how it interacts with command operations, and what lies outside it.
---

Registering a member runs two commands: one creates the member, the other opens their first loan card. If the second is rejected, you do not want a member without a card. The integration collects the events every command in the chain returns and sends them to Chronicle as **one batch**, after the outermost command has succeeded. Either all of them are appended, or none.

This is a batch on one event log, sent with the SDK's `appendMany`. It is not a transaction over other databases, HTTP calls, or services.

## Choose how to append

| How | Joins the batch | What the command result means |
| --- | --- | --- |
| Return events from `handle()` | Yes | The final verdict, after the batch is sent |
| Return `eventsWithConcurrencyScopes(...)` or `eventForEventSourceId(...)` | Yes | Same |
| `aggregate.apply(...)` on a [command aggregate](../aggregates/injecting-into-commands.md) | Yes, whether or not you return `aggregate.commit()` | Same |
| An SDK `eventLog.append(...)` inside `handle()` | No; it is appended immediately | Nothing about that append |
| A low-level `defineChronicleCommand` | No; it appends on its own | Its own result |

Return events. It is the path that keeps the command's verdict and the stored events in step.

## One batch per outer command

Returned events from nested Arc commands that share the tenant, correlation ID, and event store join the outer command's batch. Arc sends the batch after the outer command has run and its result is a success.

- If the outer command or any nested command fails, none of the staged events are sent.
- A nested command's success is provisional: its events are staged, not stored. Only the outer result carries the final verdict.
- If the outer command ignores a failed nested command, even one that staged no events, the outer command still fails, with the message `Nested Chronicle command failed; staged events were discarded`.
- A nested command with a different tenant, correlation ID, or event store fails instead of joining.
- A command that runs after the outer command has completed, such as one started from a timer, starts its own batch.

Authorization, Arc validation, and a rejecting `provide()` all run before anything is staged, so a rejected command never reaches Chronicle.

## When the batch is sent

The outer command finishes, then Arc sends the batch and turns Chronicle's answer into the command result:

| Chronicle answers | Command result |
| --- | --- |
| Every event accepted | Success, with the response `handle()` returned |
| A constraint or concurrency rejection | 400 with the validation results, and no response; see [Concurrency](concurrency.md#when-the-check-fails) |
| An error, a partial or incomplete acknowledgment, or no answer | Failure with an exception message; some events may have been stored |

A request aborted before the batch is sent sends nothing.

## Causation in a batch

The SDK stamps one causation chain per batch. Every event in it, including events from nested commands, carries the outer command's causation entry, not the entry of the command that returned it. See [Causation and auditing](causation.md).

## Events and command operations

A command may return Chronicle events together with [command operations](../../commands/operations/index.md), in a `tuple(...)`. The batch then decides whether the operations are compensated:

1. Arc runs the operations in order.
2. It sends the batch.
3. On a constraint or concurrency rejection, nothing was appended, so Arc compensates the operations in reverse order.
4. On an unknown, partial, or incomplete outcome, Arc reports the command as failed but **does not compensate**. Events may already be stored, and they cannot be undone.

Operations therefore need compensation only for a known rejection. This is still not a distributed transaction: an external system that accepted the operation stays changed until compensation runs, and a crash in between is not recovered.

## What is outside the batch

These happen outside the batch and cannot be discarded with it:

- an immediate SDK append inside `handle()`;
- a low-level `defineChronicleCommand`;
- anything a handler does directly to another store or service.

An immediate append can already be stored when the batch is later rejected, and Arc cannot see it. Arc **still compensates the command operations** in that case. Do not combine immediate appends with compensated operations when the compensation assumes no events were stored.

## Things to know

- **Reads do not see staged events.** A read model or an event-log read inside the chain sees stored events only, not the batch being built.
- **Several reactor commands are several batches.** Each command a reactor returns runs on its own; see [Returning commands from a reactor](../reactors/command-side-effects.md#return-several-commands).
- **Atomic is not the same as current.** The batch is all-or-nothing, but it does not check that the decision was made on the latest state. See [Concurrency](concurrency.md).

## Related

- [Concurrency](concurrency.md)
- [Returning events](index.md)
- [Command execution scopes](../../commands/command-execution-scopes.md)

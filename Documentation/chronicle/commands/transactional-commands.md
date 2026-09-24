---
title: Transactional commands
description: How returned events from nested commands join one event-log batch, when the batch is sent or discarded, and what lies outside it.
---

A command that runs other commands should record either all of their events or none. The integration stages returned events and sends them as one batch when the outermost command succeeds. This is a returned-event batch on one event log, **not** a .NET transaction.

## One batch per outer command

Returned events from nested Arc commands that share the tenant, correlation ID, and event store join the outer command's single `eventLog.appendMany` call.

- If the outer command or any nested command fails, none of the staged events are sent.
- A nested command's success is temporary: it is not a durable append acknowledgment. Only the outer result carries the final commit verdict.
- If the outer command ignores a failed nested command, even one that staged no events, the outer command still fails.
- A detached command that runs after the outer unit completes starts a new unit and appends on its own.

Authorization, Arc validation, and a rejecting `provide()` all run before anything is appended.

## Causation in a batch

The SDK stamps a single causation chain per batch: nested events carry the outer command's causation, not their own command's.

## What is outside the batch

These happen outside the batch and cannot be rolled back with it:

- an immediate SDK append inside `handle()`;
- a low-level `defineChronicleCommand`;
- operations performed by a separate nested command or directly inside a handler.

An immediate append can already have persisted when a later returned-event batch is rejected. Arc cannot track that immediate append through this scope and **still compensates the command operations**. Do not combine immediate appends with compensated operations when the compensation assumes no events persisted.

A command may return both Chronicle events and [command operations](../../commands/operations/index.md). Arc runs the operations first, then commits the returned-event batch. A constraint or concurrency rejection prevents the append and compensates the operations in reverse order. If Chronicle reports an incomplete, partial, or unknown outcome, Arc reports the command as failed but **does not compensate**: committed events cannot safely be undone. Operations must provide compensation for a known rejection. This is not a distributed transaction over external systems.

Aggregate `apply()` enrolls events in the same batch even if `commit()` is not returned; see [aggregates](../aggregates/index.md).

## Related

- [Concurrency](concurrency.md)
- [Returning events](index.md)

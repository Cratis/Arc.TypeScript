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
- a completed aggregate, or any non-Chronicle effect such as a MongoDB write;
- operations performed by a separate nested command or directly inside a handler.

Returning Chronicle events and [command operations](../../commands/operations/index.md) together is rejected before either effect runs, and the batch is not a commit participant for operations.

## Reactors

No aggregate-root or Arc reactor-command integration is provided. The SDK constructs reactors itself, and its side-effect dispatcher does not run Arc commands or fail a reactor partition when a command fails. Use the SDK directly for its own event-returning reactors; do not expect Arc on .NET's reactor command side-effect semantics.

## Related

- [Concurrency](concurrency.md)
- [Returning events](index.md)

---
title: Aggregates
---

After `addChronicle(builder, { eventStore, client })`, extend `AggregateRoot`, define `on<EventClassName>(event)` handlers, and bind `@inject(commandAggregate(MyAggregate))` on `handle()` or `provide()`. The command must have a nonempty resolved key (`@key()` or a key resolver). Arc reads that event source in the selected tenant namespace, replays matching registered event types in log order, then invokes the command. `apply(event)` updates in-memory state; **return `aggregate.commit()`** from the handler to stage its pending events in the same command batch. Calling `commit()` does not bypass Arc's validation, authorization, or command operation recovery. An aggregate with no matching recorded events has `isNew === true`. Event handlers receive stored event content as plain objects, not instances of the event class.

Aggregate commits carry a per-source concurrency scope based on the last rehydrated event, or `beforeFirst` for a new source; a competing append rejects the batch rather than silently applying stale state. `commandAggregate` reads Chronicle's event log, not a projected read model. It does not provide the .NET aggregate's `OnActivate`, `Failed`, stream selection, or explicit unit-of-work methods. Nested commands may stage returned events into one batch, but Arc command operations remain a flat command boundary: a nested child cannot return operations and a parent that has attempted a nested command cannot return operations. Per-event nested-command causation is not available through the SDK batch append API; the batch uses the outer command's ambient causation. An immediate event-log append is not part of the returned-event batch and cannot be rolled back by this scope.

A missing required Fundamentals concept field is rejected by Arc's input schema before `handle()`, rather than requiring .NET's `RequiredConceptFilter`.

`commandReadModel(Type)` binds command `handle()` and `provide()` parameters. In an asynchronous `CommandValidator` predicate, use `await readModelForValidation(Type, { optional: true })` to read the same command key in the trusted tenant namespace; it returns `null` for an absent model. Without `optional: true`, a missing model fails validation. This is a materialized projection snapshot, not a transactional aggregate read. Constructor-injected validator read models are not supported.

The TypeScript SDK's event seeding API sends events to Chronicle; it does not guarantee that a projection has materialized before the seeder returns. Wait for the read model explicitly in development or integration checks.

See [transactional commands](../commands/transactional-commands.md) for operation compensation and append outcomes.

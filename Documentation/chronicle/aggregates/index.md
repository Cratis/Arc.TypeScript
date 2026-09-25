---
title: Aggregates
description: Decide from one event source's full history with a keyed aggregate root that Arc rehydrates from Chronicle and whose applied events join the command's batch.
---

An order may hold at most 100 items. To enforce that, the command needs the order's current total, and it needs it to be exact: a read model that lags one event behind could let the 101st item through. An **aggregate** replays the order's own events into memory, checks the rule, and applies the new event. Because it knows which revision it replayed, a concurrent change rejects the append instead of breaking the rule.

The API is experimental and part of the optional Chronicle integration. Ordinary Arc commands do not need an event store.

## Aggregate or read model

| | Aggregate | Read model in a command |
| --- | --- | --- |
| State comes from | Replaying the event source's events on every command | A projection Chronicle stored earlier |
| Freshness | Every stored event of the handled types | Whatever the projection has processed |
| Concurrency | The append is rejected when the stream moved after the replay | None; the read model does not lock anything |
| Cost | Grows with the number of events in the stream | One lookup |
| Use it when | A rule depends on exact history of one event source | The command needs context, or a rule can tolerate lag |

A command can take both. See [Read models in commands](../read-models/injecting-into-commands.md).

## How Arc wires it

1. You define a class that extends `AggregateRoot` and registers a handler per event type.
2. A command binds it with `@inject(commandAggregate(Order))`.
3. Before `handle()` runs, Arc loads the events for the command's key, replays them through the handlers, and records the tail it read.
4. `handle()` calls methods on the aggregate, which `apply()` new events.
5. When the command succeeds, the applied events join the command's [batch](../commands/transactional-commands.md), with the recorded tail as the expected revision.

## Topics

| Topic | Description |
| --- | --- |
| [Defining an aggregate root](defining-an-aggregate-root.md) | Handlers, state, rules, and what the TypeScript aggregate does not have |
| [Injecting into commands](injecting-into-commands.md) | Binding, identity and routing, commit, concurrency, and boundaries |

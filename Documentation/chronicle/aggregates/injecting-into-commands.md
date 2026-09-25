---
title: Injecting an aggregate into a command
description: Bind a rehydrated aggregate to a command's key with commandAggregate, reject or commit its changes, and know how identity, routing, concurrency, and the batch apply.
---

With the aggregate defined, a command asks Arc for it by type. Arc loads it for the command's key, replays its history, and hands it to `handle()`. Whatever the aggregate applies is appended when the command succeeds.

## Bind the aggregate

```typescript title="AddItemToOrder.ts"
import { field } from '@cratis/fundamentals';
import { command, inject, key, rejected, validation } from '@cratis/arc.core';
import { commandAggregate } from '@cratis/arc.chronicle';
import { Order } from './Order.js';

@command()
export class AddItemToOrder {
    @field(String) @key() id = '';
    @field(String) productId = '';
    @field(Number) quantity = 0;

    @inject(commandAggregate(Order))
    handle(order: Order) {
        if (!order.canAdd(this.quantity)) {
            return rejected(validation('The order total must not exceed 100', ['quantity']));
        }
        order.addItem(this.productId, this.quantity);
    }
}
```

```typescript title="main.ts"
import 'reflect-metadata';
import { ArcApplication } from '@cratis/arc.core';
import '@cratis/arc.chronicle';
import { AddItemToOrder } from './AddItemToOrder.js';
import { ItemAdded } from './Order.js';

const builder = ArcApplication.createBuilder();
builder.withChronicle({ eventStore: 'Orders', connectionString: 'chronicle://localhost:35000' });
builder.add(AddItemToOrder, ItemAdded);
const application = await builder.build();
await application.run();
```

`Order` and `ItemAdded` come from [Defining an aggregate root](defining-an-aggregate-root.md). The aggregate class itself is not registered; `commandAggregate(Order)` is enough. Register the event types it handles, after `withChronicle`. The development connection string needs a running local Chronicle kernel; see [Add event sourcing](../add-event-sourcing.md) for other environments.

Executing `AddItemToOrder` for an empty order appends one `ItemAdded`. The next execution for the same `id` replays that event, so `quantity` starts from the stored total, and the rule is checked against it.

## Reject from handle()

`handle()` returns `rejected(validation(...))` when the aggregate says no. The caller gets a 400 with the message on the `quantity` member, and the command appends nothing, including anything the aggregate applied earlier in the same `handle()`. See [Command outcomes](../../commands/command-outcomes.md).

## Commit

`apply()` enrolls the event in the command's batch. You do not have to return anything: the command above returns nothing when it succeeds, and the event is still appended. That also holds when `handle()` calls `order.commit()` without returning it, or applies more events after calling it.

You may `return order.commit()` to make the commit visible. Do **not** also return the same event yourself; it would be appended twice, and Arc rejects a commit result whose events were already staged.

## Which events are loaded

The aggregate belongs to the command's key: the `@key()` field, `getKey()`, or `getEventSourceId()`. A command without a key fails with the exception `A command key is required for Order` before `handle()` runs.

Loading uses the same route the command's returned events use: the current tenant's namespace, the command's `@eventSourceType`, `@eventStreamType`, and its stream ID from `getEventStreamId()` or `@eventStreamId`. Arc reads the events of the types the aggregate handles, in order, and replays them. See [Event metadata](../commands/event-metadata.md).

Arc loads each aggregate type once per command. A second parameter of the same type receives the same instance. For a second aggregate **type** on the same key, bind another `commandAggregate(Type)`. There is no way to load an aggregate for a different ID; the key decides.

## Concurrency

When the aggregate loads, Arc records the tail of its route, counting every event on the route, handled or not. The events it applies are appended with that tail as an exact [concurrency scope](../commands/concurrency.md). If anything is appended to that route between load and commit, the batch is rejected with a `concurrencyViolation` 400, and nothing is appended. An event the aggregate does not handle moves the tail too, but it cannot block the aggregate permanently: the next load reads the new tail.

## Boundaries

- Applied events and returned events join the same [batch](../commands/transactional-commands.md). Nested commands share it, so an aggregate changed in a nested command commits with the outer command.
- An immediate SDK append inside `handle()` is outside the batch. It is stored even when the aggregate's batch is later rejected.
- The batch covers one event log. It is not a transaction over other stores.
- The [command subject](../commands/subject.md) applies to the aggregate's events as it does to returned events.
- `readModelForValidation` and `commandReadModel` read the stored projection, not the aggregate's replayed state. They can disagree while the projection catches up.

## Related

- [Aggregates](index.md)
- [Read models in commands](../read-models/injecting-into-commands.md)
- [Testing Chronicle commands](../../testing/chronicle.md)

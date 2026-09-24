---
title: Aggregates
description: Rehydrate a keyed aggregate from Chronicle and enroll its applied events in an Arc command.
---

Use an aggregate when a command needs to decide from one event source's history, rather than from an eventually consistent read model. This API is experimental. It is an optional Chronicle integration; ordinary Arc commands do not need an event store.

## Define the event and aggregate

Register handlers by **event class**, not by a method-name convention. A handler runs both for stored events during replay and for events applied in the current command. Keep it free of external effects.

```typescript title="Order.ts"
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { AggregateRoot } from '@cratis/arc.chronicle';

@eventType('ItemAdded')
export class ItemAdded {
    @field(String) productId = '';
    @field(Number) quantity = 0;
}

export class Order extends AggregateRoot {
    quantity = 0;

    constructor() {
        super();
        this.on(ItemAdded, event => { this.quantity += event.quantity; });
    }

    addItem(productId: string, quantity: number): void {
        if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 100 - this.quantity) {
            throw new Error('Quantity must be positive and the order total must not exceed 100');
        }
        this.apply(Object.assign(new ItemAdded(), { productId, quantity }));
    }
}
```

`on(ItemAdded, handler)` takes an optional second `EventContext` argument in the handler when you need the stored event's context. During `apply()`, that context is unavailable, so handle it as optional. Replayed payloads are reconstructed as instances of `ItemAdded`. An aggregate with no handlers can still apply events; it does not read unrelated event types during rehydration.

## Bind the command

Call `addChronicle` before registering the artifacts, as shown in [Add event sourcing](../add-event-sourcing.md). Bind the aggregate to the command's `@key()` field and register both the command and event type:

```typescript title="AddItemToOrder.ts"
import { field } from '@cratis/fundamentals';
import { command, inject, key } from '@cratis/arc.core';
import { commandAggregate } from '@cratis/arc.chronicle';
import { Order } from './Order.js';

@command()
export class AddItemToOrder {
    @field(String) @key() id = '';
    @field(String) productId = '';
    @field(Number) quantity = 0;

    @inject(commandAggregate(Order))
    handle(order: Order): void {
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
builder.addChronicle({ eventStore: 'Orders', connectionString: 'chronicle://localhost:35000' });
builder.add(AddItemToOrder, ItemAdded);
const application = await builder.build();
await application.run();
```

The development connection string requires a running local Chronicle kernel; see [development credentials](../add-event-sourcing.md#choose-who-owns-the-client) before using another environment. Executing `AddItemToOrder` with an empty order records one `ItemAdded`. A later execution replays that event, increments `quantity`, and checks the new total before appending. A rejected or failed command does not append its pending aggregate events.

`apply()` enrolls events in the command unit of work even when `handle()` returns `void`, calls `commit()` without returning it, or applies again after `commit()`. You may return `order.commit()` explicitly; do **not** also return the same event separately. Unlike the .NET aggregate, this implementation does not have `Failed(...)`, `OnActivate`, or a factory for loading a second source id. Reject invalid input through Arc validation or a failed command result, not a hidden aggregate failure list.

The command key must be present before the aggregate loads. For a second aggregate **type** on the same key, bind another `commandAggregate(Type)` parameter. Aggregate reads and writes use the current tenant namespace and the command's configured event source type, stream type, and stream id (including `getEventStreamId()`). The concurrency scope uses the unfiltered tail of that route, **including events without a handler**. A concurrent append on that route rejects the batch; an unhandled event does not permanently block the aggregate. `isNew` is true only when that route has no events at all.

## Boundaries

Applied events and returned events join one deferred [command batch](../commands/transactional-commands.md). This is not a transaction over other stores. Immediate SDK appends within `handle()` are outside the batch; compensation can run after such an append has already persisted. [Command operations](../../commands/operations/index.md) should not rely on immediate appends being rolled back.

`commandReadModel(Type)` binds model-bound command parameters. `readModelForValidation(Type, { optional: true })` is available **only to validators of model-bound commands**; it uses the command key and tenant, returns `null` for a missing model, and reads a materialized projection snapshot, not aggregate replay state. Constructor-injected validator read models are not supported.
